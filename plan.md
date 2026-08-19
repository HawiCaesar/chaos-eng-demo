# Hotel Chaos Simulator Plan

## Project Description

> A cloud resilience testing platform that provisions isolated Railway environments, injects controlled infrastructure failures, correlates application and deployment events, and measures recovery behavior.

## Core MVP Goal

Build a hotel booking workload that runs on Railway and use Railway's GraphQL API to deliberately stop and restart the primary database.

The MVP should demonstrate this flow:

1. Create a booking successfully.
2. Stop the primary database through the Railway API.
3. Submit another booking.
4. Return a clear `DATABASE_UNAVAILABLE` failure.
5. Record the failure in a separate audit database.
6. Restart the primary database through the Railway API.
7. Detect recovery.
8. Submit a booking successfully again.
9. Display the experiment timeline and recovery metrics.

## Tech Stack

### Frontend

- React
- React Router v7
- Vite
- TypeScript

### Backend

- Node.js
- TypeScript
- REST API
- Railway GraphQL API integration

### Data

- PostgreSQL primary database
- PostgreSQL audit database

### Infrastructure

- Railway
- Railway GraphQL API
- Railway services and deployments

## High-Level Architecture

```text
                    ┌────────────────────┐
                    │ React Router v7 UI │
                    │ Vite + TypeScript  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │    Booking API     │
                    │ Node + TypeScript  │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
           ┌────────────────┐    ┌────────────────┐
           │   Primary DB   │    │    Audit DB    │
           │    bookings    │    │  audit_events  │
           └────────────────┘    └────────────────┘
                    ▲
                    │
           ┌────────┴─────────┐
           │  Chaos Control   │
           │ Railway GraphQL  │
           └──────────────────┘
```

## MVP Milestones

### Milestone 1: Project Setup

Create the application structure.

Suggested monorepo layout:

```text
hotel-chaos-simulator/
│
├── apps/
│   ├── web/
│   │   └── React Router v7 + Vite + TypeScript
│   │
│   └── api/
│       └── Node.js + TypeScript
│
├── packages/
│   ├── shared/
│   └── railway-client/
│
├── docs/
│
├── package.json
└── README.md
```

Initial goals:

- Create the React Router v7 frontend.
- Configure Vite and TypeScript.
- Create the Node.js API.
- Set up shared environment configuration.
- Connect the project to Railway.

### Milestone 2: Normal Booking Flow

Build the hotel booking workload before adding chaos functionality.

Backend endpoints:

```text
POST /bookings
GET  /bookings/:id
GET  /health
```

Basic booking fields:

```text
id
guestName
email
roomId
checkIn
checkOut
status
createdAt
```

Example success response:

```json
{
  "status": "BOOKED",
  "bookingId": "BK-1821"
}
```

Frontend:

- Booking form
- Success state
- Validation failure state
- Infrastructure failure state
- Basic booking details view

MVP checkpoint:

```text
React UI
   ↓
Booking API
   ↓
Primary PostgreSQL
```

must work before adding Railway infrastructure controls.

### Milestone 3: Audit Event System

Add a separate audit database.

The audit database must stay available when the primary database is down.

Track events such as:

```text
REQUEST_RECEIVED
VALIDATION_PASSED
BOOKING_ATTEMPTED
DATABASE_UNAVAILABLE
BOOKING_FAILED
DATABASE_RECOVERED
BOOKING_CREATED
```

Suggested audit event fields:

```text
id
eventType
requestId
bookingId
experimentId
timestamp
metadata
```

Add correlation identifiers:

```text
requestId
bookingId
eventId
experimentId
```

MVP checkpoint:

A normal booking should produce an ordered event trail.

### Milestone 4: Railway GraphQL Client

Create a dedicated Railway integration layer.

Suggested interface:

```text
RailwayClient
├── getServiceStatus()
├── stopService()
├── restartService()
└── getDeploymentStatus()
```

Keep Railway GraphQL queries and mutations out of route handlers and UI code.

Initial Railway scope:

- Read service status
- Stop the primary database service
- Restart the primary database service
- Read deployment status

Do not add rollback, ephemeral environments, or advanced deployment controls yet.

### Milestone 5: Chaos Control Dashboard

Build an infrastructure control screen.

Example:

```text
HOTEL CHAOS SIMULATOR

Primary DB
● RUNNING

[ Stop Database ]

Audit DB
● RUNNING

Booking API
● RUNNING
```

Support infrastructure states such as:

```text
RUNNING
STOPPING
STOPPED
STARTING
FAILED
```

The dashboard should poll or refresh Railway state after lifecycle operations.

### Milestone 6: Database Outage Experiment

Implement the first controlled chaos scenario.

Scenario:

```text
1. Create experiment
2. Stop primary database
3. Wait for stopped state
4. Submit booking
5. Capture DATABASE_UNAVAILABLE
6. Record audit events
7. Restart database
8. Wait for recovery
9. Submit booking again
10. Confirm success
11. Finish experiment
```

Suggested experiment states:

```text
CREATED
STOPPING_DATABASE
DATABASE_DOWN
GENERATING_FAILURE
RECOVERING_DATABASE
DATABASE_RECOVERED
VERIFYING_RECOVERY
COMPLETED
FAILED
```

Suggested endpoints:

```text
POST /experiments
POST /experiments/:id/start
GET  /experiments/:id
GET  /experiments/:id/events
```

### Milestone 7: Experiment Timeline

Create a timeline from audit and infrastructure events.

Example:

```text
Experiment EXP-001

10:42:01  Experiment started
10:42:03  Database stopping
10:42:07  Database stopped
10:42:08  Booking attempted
10:42:08  DATABASE_UNAVAILABLE
10:42:08  Booking failed
10:42:19  Database restart initiated
10:42:32  Database recovered
10:42:43  Booking succeeded
10:42:44  Experiment completed
```

The timeline should connect:

```text
Experiment
   ↓
Booking request
   ↓
Audit events
   ↓
Railway service state
   ↓
Recovery
```

### Milestone 8: Recovery Metrics

Calculate a small set of useful experiment metrics:

- Total requests
- Successful requests
- Failed requests
- Failure rate
- Database downtime
- Recovery time
- Final experiment status

Example:

```text
Experiment: EXP-001
Scenario: Database outage

Requests: 2
Successful: 1
Failed: 1
Failure rate: 50%

Database downtime: 31s
Recovery time: 18s

Result: RECOVERED
```

### Milestone 9: Railway Logs

Add Railway logs after the main experiment flow works.

Display infrastructure logs beside application audit events.

Example:

```text
Application Events

10:42:08 BOOKING_ATTEMPTED
10:42:08 DATABASE_UNAVAILABLE
10:42:08 BOOKING_FAILED
```

```text
Railway Logs

10:42:07 Database stopped
10:42:08 Connection refused
10:42:09 Connection refused
```

The goal is to correlate application behavior with infrastructure events.

## MVP Definition of Done

The MVP is complete when you can run this demonstration end to end:

```text
Create successful booking
        ↓
Start chaos experiment
        ↓
Stop primary DB through Railway GraphQL
        ↓
Observe Railway state change
        ↓
Submit booking
        ↓
Receive DATABASE_UNAVAILABLE
        ↓
Record failure in audit DB
        ↓
Restart primary DB through Railway GraphQL
        ↓
Detect database recovery
        ↓
Submit booking again
        ↓
Booking succeeds
        ↓
Display event timeline
        ↓
Display recovery metrics
```

## Out of Scope for the First MVP

Keep these for later versions:

- Multiple Railway environments
- Ephemeral environment provisioning
- Automatic environment teardown
- Failed deployment scenarios
- Rollbacks
- Slow database simulation
- Audit service outage
- Dependency failure scenarios
- Advanced metrics
- Authentication
- AI-generated reports
- Multiple simultaneous experiments

## Post-MVP Direction

After the database outage experiment works reliably, expand toward the full resilience platform:

```text
MVP
│
├── Database outage
├── Railway service control
├── Audit events
├── Experiment timeline
└── Recovery metrics
     │
     ▼
V2
│
├── API restart
├── Failed deployment
├── Audit service outage
├── Dependency failures
└── Richer reports
     │
     ▼
V3
│
├── Isolated Railway environments
├── Environment provisioning
├── Automated experiment setup
├── Automated teardown
└── Reusable chaos scenarios
```

At V3, the project more fully matches the project description by provisioning isolated Railway environments for repeatable resilience experiments.
