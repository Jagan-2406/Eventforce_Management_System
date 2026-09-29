/**
 * @description Controller class for EventForce Management System (Salesforce Developer Track)
 * Provides AuraEnabled methods for LWC components: Event Catalog, Registration, QR Gate Check-in & Workforce
 */
public with sharing class EventForceController {

    // Wrapper for Event Summary
    public class EventSummaryWrapper {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String category { get; set; }
        @AuraEnabled public Date eventDate { get; set; }
        @AuraEnabled public String eventTime { get; set; }
        @AuraEnabled public String venue { get; set; }
        @AuraEnabled public Integer capacity { get; set; }
        @AuraEnabled public Integer registeredCount { get; set; }
        @AuraEnabled public Decimal ticketPrice { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String bannerUrl { get; set; }
    }

    // Wrapper for Check-in Result
    public class CheckInResult {
        @AuraEnabled public Boolean isSuccess { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public String ticketNumber { get; set; }
        @AuraEnabled public String attendeeName { get; set; }
        @AuraEnabled public String eventTitle { get; set; }
        @AuraEnabled public Datetime checkedInAt { get; set; }
    }

    /**
     * @description Fetch active events with optional category filter
     */
    @AuraEnabled(cacheable=true)
    public static List<Event__c> getEvents(String categoryFilter, String searchTerm) {
        String query = 'SELECT Id, Name, Title__c, Category__c, Event_Date__c, Event_Time__c, Venue__c, ' +
                       'Capacity__c, Registered_Count__c, Ticket_Price__c, Status__c, Banner_URL__c, Description__c ' +
                       'FROM Event__c WHERE Status__c != \'Cancelled\' ';

        if (String.isNotBlank(categoryFilter) && categoryFilter != 'All') {
            query += 'AND Category__c = :categoryFilter ';
        }

        if (String.isNotBlank(searchTerm)) {
            String searchPattern = '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';
            query += 'AND (Title__c LIKE :searchPattern OR Venue__c LIKE :searchPattern) ';
        }

        query += 'ORDER BY Event_Date__c ASC LIMIT 50';
        return Database.query(query);
    }

    /**
     * @description Retrieve complete event details including shifts and registered count
     */
    @AuraEnabled(cacheable=true)
    public static Event__c getEventDetails(Id eventId) {
        return [
            SELECT Id, Name, Title__c, Category__c, Event_Date__c, Event_Time__c, Venue__c,
                   Capacity__c, Registered_Count__c, Ticket_Price__c, Status__c, Banner_URL__c, Description__c,
                   (SELECT Id, Title__c, Role_Required__c, Shift_Start__c, Shift_End__c, Status__c, Priority__c, Location__c 
                    FROM Workforce_Shifts__r ORDER BY Shift_Start__c ASC)
            FROM Event__c
            WHERE Id = :eventId
            LIMIT 1
        ];
    }

    /**
     * @description Book event admission pass and create registration record
     */
    @AuraEnabled
    public static Event_Registration__c registerForEvent(Id eventId, String attendeeName, String email, String phone, String organization) {
        if (String.isBlank(eventId) || String.isBlank(attendeeName) || String.isBlank(email)) {
            throw new AuraHandledException('Mandatory fields missing: Event, Name, and Email are required.');
        }

        // Lock event record to prevent race-condition overbooking
        Event__c evt = [SELECT Id, Title__c, Capacity__c, Registered_Count__c, Ticket_Price__c 
                        FROM Event__c WHERE Id = :eventId FOR UPDATE];

        if (evt.Registered_Count__c >= evt.Capacity__c) {
            throw new AuraHandledException('Registration closed! This event is already at maximum capacity.');
        }

        // Find or create Attendee
        List<Attendee__c> existingAttendees = [SELECT Id, Name, Email__c FROM Attendee__c WHERE Email__c = :email LIMIT 1];
        Attendee__c attendee;
        if (!existingAttendees.isEmpty()) {
            attendee = existingAttendees[0];
        } else {
            attendee = new Attendee__c(
                Name = attendeeName,
                Email__c = email,
                Phone__c = phone,
                Organization__c = organization
            );
            insert attendee;
        }

        // Check if already registered
        List<Event_Registration__c> existingReg = [
            SELECT Id, Ticket_Number__c FROM Event_Registration__c 
            WHERE Event__c = :eventId AND Attendee__c = :attendee.Id AND Status__c != 'Cancelled' LIMIT 1
        ];
        if (!existingReg.isEmpty()) {
            throw new AuraHandledException('You have already reserved a ticket for this event: ' + existingReg[0].Ticket_Number__c);
        }

        // Generate unique ticket number
        Integer randomSuffix = Integer.valueOf(Math.floor(Math.random() * 9000) + 1000);
        String ticketNum = 'EF-2026-T' + String.valueOf(randomSuffix);

        Event_Registration__c newReg = new Event_Registration__c(
            Event__c = evt.Id,
            Attendee__c = attendee.Id,
            Ticket_Number__c = ticketNum,
            Status__c = 'Confirmed',
            QR_Code_Data__c = 'EVENTFORCE:SF:' + ticketNum + ':' + evt.Id + ':' + attendee.Id,
            Registered_At__c = Datetime.now()
        );
        insert newReg;

        // Update Event registration counter
        evt.Registered_Count__c = (evt.Registered_Count__c == null ? 0 : evt.Registered_Count__c) + 1;
        update evt;

        return newReg;
    }

    /**
     * @description Real-time Gate Entry Verification with QR data or Ticket Number
     */
    @AuraEnabled
    public static CheckInResult verifyGateCheckIn(String ticketIdentifier) {
        CheckInResult result = new CheckInResult();
        if (String.isBlank(ticketIdentifier)) {
            result.isSuccess = false;
            result.message = 'Please provide a valid ticket code or scan QR data.';
            return result;
        }

        String searchId = ticketIdentifier.trim();
        List<Event_Registration__c> regs = [
            SELECT Id, Ticket_Number__c, Status__c, QR_Code_Data__c, Checked_In_Time__c, Verified_By__c,
                   Event__r.Title__c, Attendee__r.Name 
            FROM Event_Registration__c 
            WHERE Ticket_Number__c = :searchId OR QR_Code_Data__c = :searchId 
            LIMIT 1
        ];

        if (regs.isEmpty()) {
            result.isSuccess = false;
            result.message = 'Invalid Ticket: No matching record found in EventForce system.';
            return result;
        }

        Event_Registration__c reg = regs[0];
        if (reg.Status__c == 'Checked In') {
            result.isSuccess = false;
            result.message = 'Warning: This ticket was ALREADY verified at gate on ' + reg.Checked_In_Time__c.format();
            result.ticketNumber = reg.Ticket_Number__c;
            result.attendeeName = reg.Attendee__r.Name;
            result.eventTitle = reg.Event__r.Title__c;
            result.checkedInAt = reg.Checked_In_Time__c;
            return result;
        }

        if (reg.Status__c == 'Cancelled') {
            result.isSuccess = false;
            result.message = 'Denied: This ticket has been cancelled.';
            return result;
        }

        // Mark Checked In
        reg.Status__c = 'Checked In';
        reg.Checked_In_Time__c = Datetime.now();
        reg.Verified_By__c = UserInfo.getName();
        update reg;

        result.isSuccess = true;
        result.message = 'Admission Verified! Welcome ' + reg.Attendee__r.Name;
        result.ticketNumber = reg.Ticket_Number__c;
        result.attendeeName = reg.Attendee__r.Name;
        result.eventTitle = reg.Event__r.Title__c;
        result.checkedInAt = reg.Checked_In_Time__c;
        return result;
    }

    /**
     * @description Update workforce crew shift status (Assigned -> In Progress -> Completed)
     */
    @AuraEnabled
    public static Workforce_Shift__c updateShiftStatus(Id shiftId, String newStatus) {
        Workforce_Shift__c shift = [SELECT Id, Status__c FROM Workforce_Shift__c WHERE Id = :shiftId LIMIT 1];
        shift.Status__c = newStatus;
        update shift;
        return shift;
    }
}
