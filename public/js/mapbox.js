export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiYW5kbWlyb24iLCJhIjoiY2xkZGxqYXQ2MDR0ajNuczA2bnpzOGpkNSJ9.VTkIOsSSDo2dqLenrsVmWg';

  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/andmiron/clddn3zn8000801nw8ooobs0y',
    scrollZoom: false,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((location) => {
    // create marker
    const element = document.createElement('div');
    element.className = 'marker';

    // add marker
    new mapboxgl.Marker({
      element,
      anchor: 'bottom',
    })
      .setLngLat(location.coordinates)
      .addTo(map);

    // add popup
    new mapboxgl.Popup({ offset: 30, focusAfterOpen: false })
      .setLngLat(location.coordinates)
      .setHTML(`<p>Day ${location.day} : ${location.description}</p>`)
      .addTo(map);

    // extend map bounds to include current location
    bounds.extend(location.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 200,
      right: 200,
    },
  });
};
