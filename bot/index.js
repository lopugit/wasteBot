/**
 * @Description This is the entry point file for the Wastee Facebook Chatbot
 * This bot waits for messages sent by Facebook's Webhooks System and replies
 * to these messages using the facebook Graph Messaging API
 */

// Initialize
console.log("Starting Facebook Waste Management chatbot...")  

// catches all uncaught errors so process never dies
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ', err);
});

// import external packages
let express = require('express')
let request = require('request-promise')
let axios = require('axios')
let fs = require('fs')
let FileType = require('file-type')
let uuid = require('uuid').v4
let bodyParser = require('body-parser')
let app = express()
let smarts = require('smarts')()
let FB = require('fb')

// import config
let extention = config = require('config')

// create bot authenticated instance
let bot = FB.extend(extention)

// set the access token
bot.setAccessToken(config.wastee.token)

// create mongoDB connection for querying
let MongoClient = require('mongodb').MongoClient;

// create client
let client = new MongoClient(config.uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});

// connect to client
client.connect()

// configure Express for JSON decoding
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));

// start app listening on port defined in config file
app.listen(config.port, () => console.log('Facebook Waste Management chatbot listening on 8899!'));

// basic get endpoint to easily check if bot is alive
app.get('/', (req, res) => res.send('Hello Bot World!'));

// Creates the endpoint for our webhook 
// only responds to HTTP POST request types
app.post('/webhook', async (req, res) => {  

	/**
	 * @Description Handles any Webhook HTTP POST messages sent by facebook to this bot
	 * we are expecting webhook messages containing either text messages, images attachments, 
	 * or quick_reply selections made by a user
	 * @Params 
	 * 	@var req @type {Object} is an object with the request data of the get request
	 * 	@var res @type {Object} is an object with the response functions used to send a response
	 */

	// wrap in try so bot doesn't crash on error
	try {

		// assign req.body content to body variable
		let body = req.body;

		// Checks this is an event from a page subscription
		if (body.object === 'page') {

			// Iterates over each entry - there may be multiple if batched
			body.entry.forEach(async function(entry) {

				// predefine reply so reply object can simply be modified down the line
				let reply = {
					text: "Sorry but we couldn't find any recycling information at this time or something else went wrong, please try again later",
				}

				// Gets the message. entry.messaging is an array, but 
				// will only ever contain one message, so we get index 0
				let webhook_event = entry.messaging[0];

				// log the message from facebook
				console.log("incoming webhook_event: ", webhook_event)

				// if the message has no text or the text does not contain
				// one of the predefined auto-response messages handled by Facebook itself
				// then run our chatbot response system
				if( !webhook_event.message.text || ( webhook_event.message.text && !["How does Wastee work?", "Who made Wastee?", "Where is the recycling information from?"].includes(webhook_event.message.text) ) ){

					// check type of message
					// if it is a quick_reply, this means a user has initiated a dialogue with our chat bot 
					// already and is in stage 2 of the communications
					if(webhook_event.message.quick_reply){
						
						// if the quick reply payload is 'None' it means the user chose the none of the above option
						// and Wastee did not generate any accurate information for them regarding their query
						if(webhook_event.message.quick_reply.payload == 'None'){

							reply.text = "Unfortunately we couldn't find any recycling information with the description or images you provided, please try again with a different picture or a more descriptive description, sorry and thank you for using Wastee!"

						} 
						// otherwise the user chose some response that Wastee generated by analyzing their query
						// and now Wastee needs to query for the information relating to that query
						else {

							// get the previous message query from mongodb
							let db = client.db("wastee");
							let conversations = db.collection("conversations");

							let result = await conversations.findOne({ 
								id: smarts.getsmart(webhook_event, "message.quick_reply.payload", "1234")
							})

							// check that the data is there
							if(typeof smarts.getsmart(result, "data", undefined) == 'string'){

								// parse stringified data stored in database
								result.data = smarts.parse(result.data)

								reply.text = ""
								
								// Make response a little more user friendly
								if(result.data.recyclable == 'Yes'){
									reply.text += `Yes! These are recylable`
								} else {
									reply.text += `Unfortunately these aren't recyclable. :(`
								}
								
								// append any advice to the response, not everything has advice
								if(result.data.advice) reply.text += `\n\n${result.data.advice}`
								
							}

						}

					} 

					// otherwise the the Facebook message is not a quick_reply
					else if(webhook_event.message){

						// store webhook_event.message in the message variable
						let message = webhook_event.message
						
						// if the message has attachments, forward these to the WasteAPI
						if(message.attachments){
							
							await asyncForEach(message.attachments, async attachment=>{
								
								if(attachment.type == 'image'){
									
									let url = attachment.payload.url
									let dir = __dirname+"/../"+config.imageDBpath+webhook_event.sender.id+"/"

									// create directory for sender
									if (!fs.existsSync(dir)){
										fs.mkdirSync(dir)
									}

									// add filename uuid to attachment object
									attachment.uuid = uuid()

									// create path out of local directory + sender facebook ID
									path = dir+attachment.uuid
									
									// download image to sender ID'd local folder DB
									attachment.imageData = await download(url, path)

								}
							})
							
							// Forward images request to wasteAPI
							try {

								let apiURL = "http://127.0.0.1:9898/info"

								// Forward images request to wasteAPI
								resp = await axios.post(apiURL, {
									attachments: message.attachments
								})							

							} catch(err){
								console.error(err)
							}

						} else {

							// Forward text request to wasteAPI
							try {

								let apiURL = "http://127.0.0.1:9898/info"

								// Forward text request to wasteAPI
								resp = await axios.post(apiURL, {
									message: message.text
								})

							} catch(err){
								console.error(err)
							}
							
						}

						// create connection to database to temporarily store
						// recycling information based on this users query
						let db = client.db("wastee");
						let conversations = db.collection("conversations");

						// initliase quick_replies array
						reply.quick_replies = []

						resp.data.query_output.forEach(output=>{

							let id = uuid();

							// create Facebook standardised response object
							let response = {
								content_type: "text",
								title: output.name,
								payload: id
							}

							// add response to quick_replies array to be sent to facebook
							// for the user to choose
							reply.quick_replies.push(response)

							// insert the current conversation possible response and recycling
							// data assosciated with that response choice into our database
							conversations.updateOne({
								id,
							},{
								$set: {
									id,
									data: smarts.stringify(output),
									stage: 'final'
								}
							},{
								upsert: true
							})

							
						})

						// add the default "none of these" quick_reply options to always be sent
						reply.quick_replies.push({
							content_type: "text",
							title: "None of these",
							payload: "None"
						})
						
						reply.text = "We matched the following things to your query, please select what matches the closest"

					}


					// send the response to facebook
					// 1 singular api call is used for both quick_replies response and 
					// final recycling information response as the only different is the message.quick_replies property				
					bot.api('me/messages', 'post', {
						recipient: webhook_event.sender,
						message: reply
					}, (r,e)=>{
						if(e) console.error(e)
					})

				}

								
			});

			// Returns a '200 OK' response to all requests
			res.status(200).send('EVENT_RECEIVED');
			
		} else {
			
			// Returns a '404 Not Found' if event is not from a page subscription
			res.sendStatus(404);
		}
		
	} catch(err){
		
		// catch any errors and log them
		console.error(err)
		res.sendStatus(404);
		
	}

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

	/**
	 * @Description Responds to Facebook's webhook endpoint validation with a token to verify this endpoint
	 * @Params 
	 * 	@var req @type {Object} is an object with the request data of the get request
	 * 	@var res @type {Object} is an object with the response functions used to send a response
	 */

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

async function download(url){

	/**
	 * @Description takes a url and converts the file at the url into a Binary Buffer
	 * @Params 
	 * 	@var url @type {String} is a string of the url of the image to be grabbed
	 */

	try {
		
		let res = await request({ url, resolveWithFullResponse: true, encoding: null })
		let fileType = await FileType.fromBuffer(res.body) || { ext: 'unknown' }

		return {
			bin: res.body,
			...fileType
		}
		
	} catch(err){
		
		// log the error
		console.error("Something went wrong downloading the file from url")
		console.error(err)
		
	}
}

async function asyncForEach(array, callback) {
	
	/**
	 * @Description Loops over array awaiting a callback function for each index item
	 * allowing for asynchronous actions on each index without total asynchronous behaviour
	 * @Params 
	 * 	@var array @type {Array} is an array to be looped over
	 * 	@var callback @type {Function} is a function be called where the input will be each @var array[index]
	 */
	
  for (let index = 0; index < array.length; index++) {
		
    await callback(array[index], index, array);
		
  }
	
}