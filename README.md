## Safety Net

This module wraps your Google Cloud Function that subscribes to cloud pubsub topics to automatically decode data payloads and republish messages when your function fails


```js
'use strict';

const SafetyNet = require('safetynet');
// SafetyNet.authenticate({ projectId: 'your-project', keyFilename: '/path/to/keyfile.json' });
// if, for some reason, you need to pass credentials this is how


// all configurable options listed below with their defaults
SafetyNet.configure({
  retries: 3,                    // how many times to allow a message to be retried
  attemptsKey: '_attempts',      // the key on the message to store the retry count
  failBehavior: 'error',         // what to do when the retry limit has been reached, can be 'error' or 'republish'
  errorTopic: 'safetynet-errors' // the topic to publish to when 'failBehavior' is set to 'republish'
});

exports.myFunction = SafetyNet.catch((data, event) => {

  return someAsyncMethod(data); // anything that returns a promise
});
```

The message object will flow like so:

```
                                                          
                  ┌──────────────────┐                    
                  │                  │                    
                  │ Original PubSub  │                    
                  │      Topic       │◀──────────────────┐
                  │                  │                   │
                  └──────────────────┘                   │
                            │                            │
                            ▼                            │
                    ┌───────────────┐                    │
                    │               │                    │
                    │ Your Function │                    │
                    │               │                    │
                    └───────────────┘                    │
                ┌───────┐   │   ┌───────┐                │
           ┌────┤Success├───┴───┤Failure├─┐              │
           │    └───────┘       └───────┘ ▼              │
           ▼                     ┌────────────────┐      │
       ┌──────┐                  │   Increment    │      │
       │ Exit │                  │ attempt count  │      │
       └──────┘                  └────────────────┘      │
           ▲                              │              │
           └──────┐              ┌────────┴───────┐      │
                  │              ▼                ▼      │
           ┌────────────┐    ┌───────┐        ┌───────┐  │
           │failBehavior│    │ over  │        │ under │  │
           │  = error   │◀─┬─│ retry │        │ retry │──┘
           └────────────┘  │ │ limit │        │ limit │   
                           │ └───────┘        └───────┘   
                           │                              
            ┌────────────┐ │                              
            │failBehavior│ │                              
            │= republish │◀┘                              
            └────────────┘                                
                   │                                      
                   ▼                                      
           ┌───────────────┐                              
           │               │                              
           │    PubSub     │                              
           │  errorTopic   │                              
           │               │                              
           └───────────────┘                              
```
