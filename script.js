'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10); //Usually, we don't generate IDs on our own
  clicks = 0;
  constructor(coords, distance, duration) {
    this.coords = coords; //[lat, lng]
    this.distance = distance; //in km
    this.duration = duration; //in min
  }
  // `https://geocode.xyz/${lat},${lng}?geoit=json` -geocoding endpoint

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}
class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // min/km
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////////////////
//Application architecture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');

const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const modal = document.querySelector('.modal-1');
const overlay = document.querySelector('.overlay');
const btnCloseModal = document.querySelector('.btn--close-modal');
const modalMessage = document.querySelector('.modal-message');
const btnConfirmAction = document.querySelector('.btn--confirm-action');

const btnsOptions = document.querySelectorAll('.btn--workout-options');

const editForm = document.querySelector('.modal-2');
const editDistance = document.querySelector('.edit-distance');
const editDuration = document.querySelector('.edit-duration');
const editCadence = document.querySelector('.edit-cadence');
const editElevation = document.querySelector('.edit-elevation');
const cadenceRow = document.querySelector('.cadence-row');
const elevationRow = document.querySelector('.elevation-row');
const btnCloseEditForm = document.querySelector('.btn--close-edit-form');
const btnSubmitChanges = document.querySelector('.btn--submit-changes');

const btnListOptions = document.querySelector('.btn--list-options');
const dropdownInList = document.querySelector('.dropdown-content-list');
const btnDeleteAll = document.querySelector('.btn-delete-all');
const btnShowAll = document.querySelector('.btn-show-all');
const btnSort = document.querySelector('.btn-sort-distance');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #idToDelete;
  #workoutToRender;
  #edited;
  #deleteAll = false;
  #sorted = false;

  constructor() {
    //Get user's position
    this._getPosition();

    //Load data from local storage
    this._getLocalStorage();

    //Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    btnCloseModal.addEventListener('click', App._closeModal);
    btnConfirmAction.addEventListener('click', this._confirmAction.bind(this));
    btnCloseEditForm.addEventListener('click', this._closeEditForm);
    btnSubmitChanges.addEventListener('click', this._submitChanges.bind(this));

    //Event delegation for different use cases
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    document.addEventListener('click', this._toggleOptionsAll.bind(this));
    document.addEventListener('keydown', this._escapeEditForm.bind(this));
    document.addEventListener('click', this._toggleDropdown.bind(this));
    document.addEventListener('click', this._performOption.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          //   alert("Couldn't get the current position");
          App._renderError(new Error("Couldn't get the current position!"));
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
      // Here the map is already loaded
    });
  }

  _showForm(mapEv) {
    this.#mapEvent = mapEv;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    //Clear imputs
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value =
      '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    //Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    //New workout
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    //If running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return App._renderError(
          new Error(`Inputs have to be positive numbers.`)
        );

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    //If cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      //Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return App._renderError(
          new Error(`Inputs have to be positive numbers.`)
        );

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    //Async operation: getting data from API, then render workout with location in list & on map
    this._renderWorkoutWithLocation(workout);

    //Hide form & Clear input fields
    this._hideForm();
  }

  async _renderWorkoutWithLocation(workout) {
    try {
      const [lat, lng] = workout.coords;
      const response = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json`
        // `http://api.geonames.org/findNearbyPlaceName?lat=${lat}&lng=${lng}&username=demo`
      );
      if (!response.ok) throw new Error(`Problem getting country data.`);
      const data = await response.json();
      workout.location = `${workout.type[0].toUpperCase()}${workout.type.slice(
        1
      )} in ${data.city}, ${data.country || ''}`;

      // Getting rid of ',' if the API cannot find the country
      if (workout.location.slice(-2, -1) === ',')
        workout.location = workout.location.replace(',', '');
      //Add new object to workout array
      this.#workouts.push(workout);

      //Render workout in list
      this._renderWorkout(workout);

      //Render workout on map as marker
      this._renderWorkoutMarker(workout);

      //Set local storage to all workouts
      this._setLocalStorage();
    } catch (err) {
      this._renderConfirmationPopup('_'); //to ask the user if he wants to render the workout without location
      this.#workoutToRender = workout;
    }
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    this.#markers.push(L.marker(workout.coords));
  }

  _showAllWorkouts() {
    const group = new L.featureGroup(this.#markers);
    this.#map.fitBounds(group.getBounds());
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${
            workout.location || workout.description
          }</h2>
          <div class="dropdown-container">
            <button class="btn--workout-options">
              <i class="fa fa-bars"></i>
            </button>
            <div class="dropdown-content not-visible">
              <ul>
                <li class="option btn-edit"><i class="fa fa-edit"></i> Edit</li>
                <li class="option btn-delete"><i class="fa fa-trash"></i> Delete</li>
              </ul>
            </div>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === 'running') {
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
    </li>`;
    }
    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;
    }
    document
      .querySelector('.workout-list')
      .insertAdjacentHTML('afterbegin', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl || e.target.closest('.dropdown-container')) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    //using the public interface
    workout.click();
  }

  //LocalStorage - a small API; don't use it to store large amounts of data
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); //key-value store; the second value must be a string
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    //Re-build Running and Cycling objects
    data.forEach(
      workout =>
        (workout.__proto__ =
          workout.type === 'running' ? Running.prototype : Cycling.prototype)
    );

    //Restore workouts array
    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      /* this._renderWorkoutMarker(work); 
        The method doesn't work, because this operation happens right when the page loads
      <=> on page load, the map isn't created yet (!!! Example for ASYNC JS neccesity)
      */
    });
  }

  _toggleDropdown(e) {
    const btnEl = e.target.closest('.btn--workout-options');

    if (!btnEl) {
      this._closeDropdowns();
      return;
    }
    btnEl.nextElementSibling.classList.toggle('not-visible');
  }

  _toggleOptionsAll(e) {
    //Name the sort option
    if (!this.#sorted) {
      btnSort.innerHTML = `<i class="fa fa-sort"></i> Sort by distance`;
    }
    if (this.#sorted) {
      btnSort.innerHTML = `<i class="fa fa-sort"></i> Unsort`;
    }

    //Hide/open the dropdown
    const optionsBtnEl = e.target.closest('.btn--list-options');

    if (!optionsBtnEl) {
      this._closeOptionsAll();
      return;
    }
    dropdownInList.classList.toggle('not-visible');
  }

  //Event callback for the 5 options (document - event delegation)
  _performOption(e) {
    if (!e.target.closest('.option')) return;

    //User clicks delete
    if (e.target.closest('.option').classList.contains('btn-delete')) {
      this.#idToDelete = e.target.closest('.workout').dataset.id;
      this._renderConfirmationPopup('one workout');
    }

    //User clicks edit
    if (e.target.closest('.option').classList.contains('btn-edit')) {
      const workout = this.#workouts.find(
        workout => workout.id === e.target.closest('.workout').dataset.id
      );
      this._openEditForm(workout);
    }

    //User clicks delete all
    if (e.target.closest('.option').classList.contains('btn-delete-all')) {
      this._renderConfirmationPopup('all workouts');
    }

    //User clicks show all
    if (e.target.closest('.option').classList.contains('btn-show-all')) {
      this._showAllWorkouts();
    }

    //User clicks sort
    if (e.target.closest('.option').classList.contains('btn-sort-distance')) {
      this._sortWorkouts();
    }
  }

  _sortWorkouts() {
    //Empty workout list
    document.querySelector('.workout-list').innerHTML = ``;

    //Sort
    if (!this.#sorted) {
      const sortedWorkouts = this.#workouts
        .slice()
        .sort((a, b) => a.distance - b.distance);
      sortedWorkouts.forEach(workout => this._renderWorkout(workout));
    }
    //Unsort
    if (this.#sorted) {
      this.#workouts.forEach(workout => this._renderWorkout(workout));
    }
    //Invert state
    this.#sorted = !this.#sorted;
  }

  _removeWorkout(id) {
    this.#workouts = this.#workouts.filter(workout => workout.id !== id + '');
    this._setLocalStorage();
    document.querySelectorAll('.workout').forEach(workout => {
      if (workout.dataset.id === id + '') workout.remove();
    });
  }

  _confirmAction() {
    App._closeModal();

    //If you need to delete all workouts
    if (this.#deleteAll) {
      this.reset();
    }
    //If you need to delete one workout
    else if (this.#workouts.some(workout => workout.id === this.#idToDelete)) {
      console.log(this.#idToDelete);
      this._removeWorkout(this.#idToDelete);
      location.reload();
    } else {
      // User confirmed rendering workout without location

      //Add new object to workout array
      this.#workouts.push(this.#workoutToRender);
      //Render workout in list
      this._renderWorkout(this.#workoutToRender);
      //Render workout on map as marker
      this._renderWorkoutMarker(this.#workoutToRender);
      //Set local storage to all workouts
      this._setLocalStorage();
    }
  }

  _openEditForm(workout) {
    editForm.classList.remove('not-visible');
    overlay.classList.remove('not-visible');

    editDistance.value = workout.distance;
    editDuration.value = workout.duration;
    if (workout.type === 'running') {
      editCadence.value = workout.cadence;
      cadenceRow.classList.remove('not-visible');
      elevationRow.classList.add('not-visible');
    }
    if (workout.type === 'cycling') {
      editElevation.value = workout.elevationGain;
      elevationRow.classList.remove('not-visible');
      cadenceRow.classList.add('not-visible');
    }
    this.#edited = workout;
  }

  _closeEditForm() {
    editForm.classList.add('not-visible');
    overlay.classList.add('not-visible');
  }

  _escapeEditForm(e) {
    if (e.key === 'Escape') {
      this._closeEditForm();
    }
  }

  _submitChanges(e) {
    //Getting data from form
    const newDistance = editDistance.value;
    const newDuration = editDuration.value;
    const newCadence = editCadence.value;
    const newElevation = editElevation.value;

    this.#edited.distance = newDistance;
    this.#edited.duration = newDuration;

    if (this.#edited.type === 'running') {
      this.#edited.cadence = newCadence;
      this.#edited.pace = this.#edited.calcPace();
    }
    if (this.#edited.type === 'cycling') {
      this.#edited.elevationGain = newElevation;
      this.#edited.speed = this.#edited.calcSpeed();
    }

    this._setLocalStorage();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload(); //object in browser; the attached method reloads the page
  }
  _renderConfirmationPopup(deleteType) {
    App._openModal();
    if (deleteType === 'one workout' || deleteType === 'all workouts') {
      modalMessage.textContent = `Are you sure you want to delete ${
        deleteType === 'one workout' ? 'this workout' : 'all workouts'
      } ? This will reload the page.`;
      deleteType === 'all workouts'
        ? (this.#deleteAll = true)
        : (this.#deleteAll = false);
    } else
      modalMessage.textContent = `Problem getting location data from API. Would you still like to render your workout?`;
    btnCloseModal.textContent = 'Close';
    btnConfirmAction.classList.remove('not-visible');
  }
  _closeDropdowns() {
    document.querySelectorAll('.dropdown-content').forEach(drop => {
      drop.classList.add('not-visible');
    });
  }
  _closeOptionsAll() {
    dropdownInList.classList.add('not-visible');
  }
  static _openModal() {
    modal.classList.remove('not-visible');
    overlay.classList.remove('not-visible');
  }
  static _closeModal() {
    modal.classList.add('not-visible');
    overlay.classList.add('not-visible');
  }

  static _renderError(err) {
    App._openModal();
    modalMessage.textContent = `${err.message} Try again! `;
    btnCloseModal.textContent = 'Ok';
    btnConfirmAction.classList.add('not-visible');
    console.error(`${err}`);
  }
}

const app = new App();
