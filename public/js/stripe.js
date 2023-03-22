import axios from 'axios';
import { showAlert } from './alerts';
const stripe = Stripe('publicAPIkey');

export const bookTour = async (tourId) => {
  try {
    // get session from the server
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    showAlert('error', err);
  }
};
