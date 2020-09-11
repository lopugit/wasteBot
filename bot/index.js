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

				// Gets the message. entry.messaging is an array, but 
				// will only ever contain one message, so we get index 0
				let webhook_event = entry.messaging[0];

				console.log("unhandled webhook_event: ", webhook_event)


				// new message
				if(webhook_event.message){
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

							let resp = await axios.post(apiURL, {
								attachments: message.attachments
							})

							bot.api('me/messages', 'post', {
								recipient: webhook_event.sender,
								message: {
									text: resp.data.info
								}
							}, (r,e)=>{
								if(e) console.error(e)
							})
							

						} catch(err){
							console.error(err)
						}

					} else {

						// Forward request to wasteAPI
						try {

							let apiURL = "http://127.0.0.1:9898/info"

							let resp = await axios.post(apiURL, {
								message: message.text
							})

							bot.api('me/messages', 'post', {
								recipient: webhook_event.sender,
								message: {
									text: resp.data.info
								}
							}, (r,e)=>{
								if(e) console.error(e)
							})

						} catch(err){
							console.error(err)
						}
						
					}

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