# AFRICASTALKING FRESHDESK PLUGIN

## COMPONENTS
1. Janus WebRTC Server - https://janus.conf.meetecho.com/
2. Africastalking servers.
3. Freshdesk API
4. Client's call queuer/Dial Plan provider - script attached below.
5. Client's event handler - script attached below.

### DEFINITIONS & IMPORTANT LINKS
1. Africastalking Voice Documentation: http://docs.africastalking.com/voice

2. Gist & script samples: https://gist.github.com/Africastalking-Voice/13ba250ab490666c2d5571563052b0c2

3. Definitions:
  + **AT** - Africastalking https://africastalking.com/
    
  + **Dial Plan**   - Instruction set fetched by the Africastalking API when a call is made.
    
  + **Call Queuer** - Script that will receive ticket data from Freshdesk and queue call with client's database.
    
  + **Call Event Handler** - Script that will receive event notifications from AT's APIs

## WORKFLOW
1. Freshdesk application is initialized.
  - Janus starts the SIP server and registers the SIP number provided during installatione of the application.
  - On success it notifies that the server was registered successfully, on fail it also notifies the user of the failure to connect.
2. Call is executed from Freshdesk to ticket owner's number.
  - When the call button is pressed, a POST using the Freshdesk Request API is made to a queuing server that recieves the ticket information.
  - A SIP call is then executed through the Janus SIP plugin and the call request is made to the Africastalking APIs.
3. Africastalking APIs receive the call request.
  - When Africastalking's APIs receive the call request, it visit's the client's callback URL to retrieve their Dial Plan. 
  - A Dial Plan refers to the instructions that a client wishes to be executed when a call is made to or through their SIP/Virtual numbers.
  - The dial plan should then be populated with a Dial function that has the phone number recorded with the ticket (Passed on earlier using the Freshdesk Request API to the client's queueing server/script).
  - Africastalking's API's then make the call to the phone number as per instructions and the call is bridged to the Janus SIP plugin.
  - Media is streamed to the client's browser and the 'Call' button changes to a 'Hang Up' button. 
4. On termination of the call.
  - The hangup button converts back to a call button and media ceases to be streamed to the client's browser.
  
---