// 05/08/2020
// Initialize
console.log("Starting Facebook Waste Management chatbot...")  
// ES5
let FB = require('fb')

let secrets = require('secret')

let extention = config = {
	appId: "2710167052529715",
	appSecret: secrets.secret
}

// create bot authenticated instance
let bot = FB.extend(extention)

// set the access token
bot.setAccessToken(secrets.wasteeToken)



let express = require('express'),
    bodyParser = require('body-parser'),
    app = express();
 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
 
app.listen(8899, () => console.log('Facebook Waste Management chatbot listening on 8899!'));
 
app.get('/', (req, res) => res.send('Hello World!'));

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];

			// new message
			if(webhook_event.message){
				let message = webhook_event.message

				if(message.attachments){
					bot.api('me/messages', 'post', {
						recipient: webhook_event.sender,
						message: {
							text: "Thanks for recycling properly, we're working on getting you the recycling information required to recycle the items in your picture!"
						}
					}, (e,r)=>{
						if(e) console.error(e)
						let debug = 1
					})

				} else {
					bot.api('me/messages', 'post', {
						recipient: webhook_event.sender,
						message: {
							text: "Hi "+message.text+", I'm Dad"
						}
					}, (e,r)=>{
						if(e) console.error(e)
						let debug = 1
					})
				}

			}
			console.log(webhook_event)
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "wastee"
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});
// done initializing
console.log("Facebook Waste Management chatbot started!")