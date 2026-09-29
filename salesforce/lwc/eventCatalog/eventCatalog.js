import { LightningElement, track, wire } from 'lwc';
import getEvents from '@salesforce/apex/EventForceController.getEvents';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class EventCatalog extends LightningElement {
    @track events = [];
    @track selectedCategory = 'All';
    @track searchTerm = '';
    @track isLoading = false;

    categoryOptions = [
        { label: 'All Categories', value: 'All' },
        { label: 'Conference', value: 'Conference' },
        { label: 'Technical', value: 'Technical' },
        { label: 'Cultural', value: 'Cultural' },
        { label: 'Sports', value: 'Sports' },
        { label: 'Workshop', value: 'Workshop' }
    ];

    connectedCallback() {
        this.fetchEventsList();
    }

    fetchEventsList() {
        this.isLoading = true;
        getEvents({ categoryFilter: this.selectedCategory, searchTerm: this.searchTerm })
            .then(result => {
                this.events = result;
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                this.showToast('Error', error.body ? error.body.message : error.message, 'error');
            });
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.fetchEventsList();
    }

    handleCategoryChange(event) {
        this.selectedCategory = event.detail.value;
        this.fetchEventsList();
    }

    handleOpenBookingModal(event) {
        const eventId = event.target.dataset.id;
        this.dispatchEvent(new CustomEvent('selectevent', { detail: { eventId } }));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
