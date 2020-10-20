// 05/08/2020

// Initialize
console.log("Starting Facebook Waste Management chatbot...")  

// so process never dies
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ', err);
});

// ES5
let FB = require('fb')

let extention = config = require('config')

// create bot authenticated instance
let bot = FB.extend(extention)

// set the access token
bot.setAccessToken(config.wastee.token)

let express = require('express')
let request = require('request-promise')
let axios = require('axios')
let fs = require('fs')
let FileType = require('file-type')
let uuid = require('uuid').v4
let bodyParser = require('body-parser')
let app = express()
let smarts = require('smarts')()

// create mongoDB connection for querying
let MongoClient = require('mongodb').MongoClient;

let uri = config.uri

let client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});

client.connect()

app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));

app.listen(config.port, () => console.log('Facebook Waste Management chatbot listening on 8899!'));

app.get('/', (req, res) => res.send('Hello Bot World!'));

// Creates the endpoint for our webhook 
app.post('/webhook', async (req, res) => {  
	try {

		let body = req.body;

		// Checks this is an event from a page subscription
		if (body.object === 'page') {

			// Iterates over each entry - there may be multiple if batched
			body.entry.forEach(async function(entry) {

				let reply = {
					text: "Sorry but we couldn't find any recycling information at this time or something else went wrong, please try again later",
				}

				// Gets the message. entry.messaging is an array, but 
				// will only ever contain one message, so we get index 0
				let webhook_event = entry.messaging[0];

				console.log("incoming webhook_event: ", webhook_event)
				if(webhook_event.message.text && !["How does Wastee work?", "Who made Wastee?", "Where is the recycling information from?"].includes(webhook_event.message.text)){
					// check type of message
					if(webhook_event.message.quick_reply){


						if(webhook_event.message.quick_reply.payload == 'None'){

							reply.text = "Unfortunately we couldn't find any recycling information with the description or images you provided, please try again with a different picture or a more descriptive description, sorry and thank you for using Wastee!"

						} else {
							// get the previous message query from mongodb
							let db = client.db("wastee");
							let conversations = db.collection("conversations");

							let result = await conversations.findOne({ 
								id: smarts.getsmart(webhook_event, "message.quick_reply.payload", "1234")
							})
							
							
							if(typeof smarts.getsmart(result, "data", undefined) == 'string'){
								result.data = smarts.parse(result.data)

								if(result.stage == "category"){
									
									reply.quick_replies = []
									
									result.data.forEach(item=>{

										let id = uuid();

										let response = {
											content_type: "text",
											title: item.name,
											payload: id
										}

										reply.text = "If your item matches one of the following things please select it"
										reply.quick_replies.push(response)
										
										conversations.updateOne({
											id,
										},{
											$set: {
												id,
												data: smarts.stringify(item),
												stage: "final"
											}
										},{
											upsert: true
										})
										
									})

									reply.quick_replies.push({
										content_type: "text",
										title: "None of these",
										payload: "None"
									})

								} else {

									reply.text = `Is it recyclable? ${result.data.recyclable == 'Yes' ? 'Yes!' : 'Unfortunately not. :('}`
									if(result.data.advice) reply.text += `\n\n${result.data.advice}`
					
								}
								
							}

						}

					} else if(webhook_event.message){
						let message = webhook_event.message
						
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
							
							// Forward request to wasteAPI
							try {

								let apiURL = "http://127.0.0.1:9898/info"

								resp = await axios.post(apiURL, {
									attachments: message.attachments
								})							

								reply.text = resp.data.info

							} catch(err){
								console.error(err)
							}

						} else {

							// Forward request to wasteAPI
							try {

								let apiURL = "http://127.0.0.1:9898/info"

								resp = await axios.post(apiURL, {
									message: message.text
								})

								reply.text = resp.data.info

							} catch(err){
								console.error(err)
							}
							
						}

						let rangled = {}
						resp.data.query_output.forEach(output=>{
							
							let rangledCat = smarts.gosmart(rangled, output.category, [])
							rangledCat.push(output)

						})

						let db = client.db("wastee");
						let conversations = db.collection("conversations");

						reply.quick_replies = []

						Object.keys(rangled).forEach(key=>{
							let id = uuid();

							let response = {
								content_type: "text",
								title: key,
								payload: id
								// payload: smarts.stringify(resp.data)
							}

							reply.quick_replies.push(response)

							conversations.updateOne({
								id,
							},{
								$set: {
									id,
									data: smarts.stringify(rangled[key]),
									stage: 'category'
								}
							},{
								upsert: true
							})

							
						})

						reply.quick_replies.push({
							content_type: "text",
							title: "None of these",
							payload: "None"
						})
						
						reply.text = "We matched the following categories to your query, please select the closest one"

					}
									
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
		
		console.error(err)
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

async function download(url, path){
	try {
		
		let res = await request({ url, resolveWithFullResponse: true, encoding: null })
		let fileType = await FileType.fromBuffer(res.body) || { ext: 'unknown' }

		// for writing image data to file, but we don't really need this
		// fs.writeFileSync(path+"."+fileType.ext, res.body)
		
		return {
			bin: res.body,
			...fileType
		}
		
	} catch(err){
		
		console.error("Something went wrong downloading the file from url")
		console.error(err)
		
	}
}

async function asyncForEach(array, callback) {
	
  for (let index = 0; index < array.length; index++) {
		
    await callback(array[index], index, array);
		
  }
	
}