
// Initialize
console.log("Starting Facebook Waste Management chatbot")

// ES5
let FB = require('fb')

let secret = require('secret')

let options = {
	appId: "2710167052529715",
	secret
}

fb = new FB.Facebook(options);