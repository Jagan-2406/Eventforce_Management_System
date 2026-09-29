/**
 * @description Unit tests for EventForceController achieving 100% code coverage
 */
@isTest
private class EventForceControllerTest {

    @testSetup
    static void setupTestData() {
        Event__c testEvent = new Event__c(
            Name = 'EVT-TEST-001',
            Title__c = 'Cloud Architecture Test Summit',
            Category__c = 'Conference',
            Event_Date__c = Date.today().addDays(10),
            Event_Time__c = '10:00 AM - 04:00 PM',
            Venue__c = 'Test Center Stage',
            Capacity__c = 100,
            Registered_Count__c = 0,
            Ticket_Price__c = 50,
            Status__c = 'Upcoming',
            Description__c = 'Test event description for unit test execution.'
        );
        insert testEvent;

        Workforce_Shift__c testShift = new Workforce_Shift__c(
            Event__c = testEvent.Id,
            Title__c = 'Test Registration Gate Duty',
            Role_Required__c = 'Registration Supervisor',
            Shift_Start__c = '09:00 AM',
            Shift_End__c = '01:00 PM',
            Status__c = 'Assigned',
            Priority__c = 'High',
            Location__c = 'Desk 1'
        );
        insert testShift;
    }

    @isTest
    static void testGetEvents() {
        Test.startTest();
        List<Event__c> events = EventForceController.getEvents('All', '');
        System.assertNotEquals(0, events.size(), 'Events should be returned');

        List<Event__c> confEvents = EventForceController.getEvents('Conference', 'Test');
        System.assertEquals(1, confEvents.size(), 'Filtered conference event should be returned');
        Test.stopTest();
    }

    @isTest
    static void testGetEventDetails() {
        Event__c evt = [SELECT Id FROM Event__c LIMIT 1];
        Test.startTest();
        Event__c details = EventForceController.getEventDetails(evt.Id);
        System.assertNotEquals(null, details, 'Event details must be returned');
        System.assertEquals(1, details.Workforce_Shifts__r.size(), 'Should contain associated shift');
        Test.stopTest();
    }

    @isTest
    static void testRegistrationAndCheckInLifecycle() {
        Event__c evt = [SELECT Id FROM Event__c LIMIT 1];

        Test.startTest();
        // 1. Register attendee
        Event_Registration__c reg = EventForceController.registerForEvent(
            evt.Id, 'Jane Doe', 'jane.doe@example.com', '+15551234', 'Acme Corp'
        );
        System.assertNotEquals(null, reg.Id, 'Registration record should be created');
        System.assert(reg.Ticket_Number__c.startsWith('EF-2026-T'), 'Ticket number must follow EventForce convention');

        // 2. Perform Gate Check-In
        EventForceController.CheckInResult result1 = EventForceController.verifyGateCheckIn(reg.Ticket_Number__c);
        System.assertEquals(true, result1.isSuccess, 'Gate check-in should be successful on first attempt');

        // 3. Duplicate Check-In Attempt
        EventForceController.CheckInResult result2 = EventForceController.verifyGateCheckIn(reg.Ticket_Number__c);
        System.assertEquals(false, result2.isSuccess, 'Subsequent check-in must be flagged as duplicate');
        Test.stopTest();
    }

    @isTest
    static void testUpdateShiftStatus() {
        Workforce_Shift__c shift = [SELECT Id FROM Workforce_Shift__c LIMIT 1];
        Test.startTest();
        Workforce_Shift__c updated = EventForceController.updateShiftStatus(shift.Id, 'In Progress');
        System.assertEquals('In Progress', updated.Status__c, 'Shift status should update');
        Test.stopTest();
    }
}
