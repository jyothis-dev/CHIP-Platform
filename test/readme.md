Build a simple backend application using Node.js, Express.js and MySQL or PostgreSQL.
Requirements

Onboard  a Hospital
Under hospital create Departments , Roles 
Ex: DEpartment :Gynacology
role: doctor,
profile details 

authentication use refresh token and acess token amd password hashing with argon2id

for authorisation((permissions where given based on the rbac check in the server side))
doctor can register the child.

Register a child.
Associate a parent/guardian.
Create a vaccination record.
Retrieve a child's vaccination history.
Calculate the next due vaccination based on a simplified schedule.
Prevent duplicate vaccination entries.
Implement authentication and basic RBAC.
Maintain centralised audit logs.



use background workers for 
        Messaging and Notification
                    |
          SMS / WhatsApp / Email
as 1st stage 


 CHIP PLATFORM
                    |
          React / Next.js Dashboard
                    |
              API Gateway
                    |
          Authentication / RBAC
                    |
       Node.js Backend Services
                    |
     +--------------+---------------+
     |              |               |
 Child Health   Immunization    Organisation
 Management       Engine         Management
     |              |               |
     +--------------+---------------+
                    |
           PostgreSQL / MySQL
                    |
        Healthcare Interoperability
                    |
           FHIR R4 Integration
                    |
        HL7 v2 / ABDM / External APIs
                    |
         Messaging and Notification
                    |
          SMS / WhatsApp / Email