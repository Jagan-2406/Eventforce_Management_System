import { LightningElement, track } from 'lwc';
import verifyGateCheckIn from '@salesforce/apex/EventForceController.verifyGateCheckIn';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GateCheckInScanner extends LightningElement {
    @track ticketInput = '';
    @track checkInResult = null;
    @track isLoading = false;

    handleInputChange(event) {
        this.ticketInput = event.target.value;
    }

    handleVerifyCheckIn() {
        if (!this.ticketInput) {
            this.showToast('Validation Error', 'Please enter a ticket code', 'warning');
            return;
        }

        this.isLoading = true;
        this.checkInResult = null;

        verifyGateCheckIn({ ticketIdentifier: this.ticketInput })
            .then(result => {
                this.checkInResult = result;
                this.isLoading = false;
                if (result.isSuccess) {
                    this.showToast('Verified', result.message, 'success');
                    this.ticketInput = '';
                } else {
                    this.showToast('Check-in Warning', result.message, 'warning');
                }
            })
            .catch(error => {
                this.isLoading = false;
                this.checkInResult = {
                    isSuccess: false,
                    message: error.body ? error.body.message : error.message
                };
                this.showToast('Error', this.checkInResult.message, 'error');
            });
    }

    get bannerClass() {
        if (!this.checkInResult) return '';
        return this.checkInResult.isSuccess 
            ? 'slds-notify slds-notify_alert slds-alert_success slds-m-top_medium slds-box'
            : 'slds-notify slds-notify_alert slds-alert_warning slds-m-top_medium slds-box';
    }

    get iconName() {
        return this.checkInResult && this.checkInResult.isSuccess ? 'utility:success' : 'utility:warning';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
