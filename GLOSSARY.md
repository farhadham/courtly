# Courtly

A booking platform for a single sports facility. Users reserve courts by the hour; admins manage the courts and observe the day's business.

## Language

### Resources

**Court**:
A bookable playing surface at the facility, identified by a name and a sport type, with an hourly price and a daily opening window.
_Avoid_: Field, pitch, resource, venue, room

**Sport type**:
The kind of play a court supports, such as padel or tennis. The facility may introduce new ones at any time, so it is a label rather than a fixed set.
_Avoid_: Category, discipline, modality

**Slot**:
One hour of a court's opening window. The unit at which availability is displayed and the granularity at which bookings are made.
_Avoid_: Time slot, period, interval

**Availability**:
The set of a court's slots on a given day that no active booking covers.
_Avoid_: Free time, open slots, schedule

**Active court**:
A court that appears in listings and accepts new bookings.
_Avoid_: Enabled, published, live

**Deactivated court**:
A court withdrawn from listing and booking while retaining its full booking history.
_Avoid_: Deleted, archived, disabled, inactive

### Booking

**Booking**:
A user's reservation of one court for a contiguous run of one or two slots.
_Avoid_: Reservation, appointment, session

**Cancelled booking**:
A booking released by its owner within the cancellation window, whose slots return to availability.
_Avoid_: Voided, refunded, dropped

**Cancellation window**:
The two hours before a booking's start time during which the booking may still be cancelled; inside it, cancellation is refused.
_Avoid_: Cutoff, grace period, deadline

**Booking owner**:
The user who created a booking and is the only party permitted to cancel it.
_Avoid_: Customer, client, member

### People

**User**:
A person who browses courts, books them, and cancels their own bookings.
_Avoid_: Customer, client, member, player

**Admin**:
A person who manages courts and views all bookings across the facility.
_Avoid_: Administrator, staff, operator, manager

### Money

**Hourly price**:
The amount a court charges for one slot.
_Avoid_: Rate, fee, cost

**Day revenue**:
The total expected income from a day's non-cancelled bookings, across all courts.
_Avoid_: Turnover, takings, income
