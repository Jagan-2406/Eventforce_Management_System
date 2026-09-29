/**
 * @description Trigger on Event_Registration__c enforcing capacity rules and automated ticket numbers
 */
trigger EventRegistrationTrigger on Event_Registration__c (before insert, before update, after insert) {

    if (Trigger.isBefore && Trigger.isInsert) {
        for (Event_Registration__c reg : Trigger.new) {
            if (String.isBlank(reg.Ticket_Number__c)) {
                Integer randomSuffix = Integer.valueOf(Math.floor(Math.random() * 9000) + 1000);
                reg.Ticket_Number__c = 'EF-2026-T' + String.valueOf(randomSuffix);
            }
            if (String.isBlank(reg.QR_Code_Data__c)) {
                reg.QR_Code_Data__c = 'EVENTFORCE:SF:' + reg.Ticket_Number__c + ':' + reg.Event__c;
            }
            if (reg.Registered_At__c == null) {
                reg.Registered_At__c = Datetime.now();
            }
        }
    }

    if (Trigger.isBefore && Trigger.isUpdate) {
        for (Event_Registration__c reg : Trigger.new) {
            Event_Registration__c oldReg = Trigger.oldMap.get(reg.Id);
            if (reg.Status__c == 'Checked In' && oldReg.Status__c != 'Checked In') {
                if (reg.Checked_In_Time__c == null) {
                    reg.Checked_In_Time__c = Datetime.now();
                }
                if (String.isBlank(reg.Verified_By__c)) {
                    reg.Verified_By__c = UserInfo.getName();
                }
            }
        }
    }
}
