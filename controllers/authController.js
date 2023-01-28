const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { promisify } = require('util');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');
const User = require('./../models/userModel');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password exist
  if (!email || !password) {
    next(new AppError('please provide email and password', 400));
  }

  // 2) check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('incorrect email or password', 401));
  }

  // 3) if everything ok, send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) getting the token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token)
    // console.log(req.headers);
    return next(new AppError('you are not logged in. please log in', 401));

  // 2) verificate the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) return next(new AppError('user no longer exist'), 401);

  // 4) check if user changed password after token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('user recently changed password', 401));
  }

  // grant access to protected route
  req.user = freshUser;
  next();
});

// only for rendered pages, no errors
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.jwt) {
    // 1) verificate the token
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );

    // 2) check if user still exists
    const freshUser = await User.findById(decoded.id);
    if (!freshUser) return next();

    // 3) check if user changed password after token was issued
    if (freshUser.changedPasswordAfter(decoded.iat)) {
      return next();
    }

    // grant access to protected route
    res.locals.user = freshUser;
    return next();
  }
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is array, middleware has access to it because of closure
    if (!roles.includes(req.user.role)) {
      return next(new AppError('you do not have permission'), 403);
    }

    next();
  };
};

exports.forgotPasswsord = catchAsync(async (req, res, next) => {
  // 1) get user on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('there is no user with this email'), 404);

  // 2) generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) send it to user email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `submit you new PATCH request with your new password and passwordConfirm to: ${resetURL}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'your password reset token is valid for 10 mins',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new AppError('there was an error sending an email'), 500);
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: {
      $gt: Date.now(),
    },
  });

  // 2) if token has not expired, and user, set the new password
  if (!user) return next(new AppError('token is invalid or has expired', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3) update changedPasswordAt property for the user

  // 4) log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) get user from the collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) check if posted current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('old password is incorrect', 401));
  }

  // 3) if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) log the user in, send JWT
  createSendToken(user, 200, res);
});
