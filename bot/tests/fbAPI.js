// testing dependancies
let expect = require('chai').expect
let test = it

describe("Test Facebook API functionality", ()=>{

	test("Facebook should respond with no error when trying to put a new message into a conversation", (done)=>{

		let FB = require('fb')

		// import config
		let extention = config = require('config')

		// create bot authenticated instance
		let bot = FB.extend(extention)

		// set the access token
		bot.setAccessToken(config.devBot.token)

		let err = false

		bot.api('me/messages', 'post', {
			recipient: { id: '3710665022299286' },
			message: {
				text: 'test'
			}
		}, (r)=>{

			expect(r).to.not.have.own.property("error")
			expect(r).to.have.own.property("message_id")
			expect(r).to.have.own.property("recipient_id")
			done()
		})
		
		
	})

	test("Facebook should respond with an error when trying to put a new message into a conversation with an incorrectly formatted recipient object", (done)=>{

		let FB = require('fb')

		// import config
		let extention = config = require('config')

		// create bot authenticated instance
		let bot = FB.extend(extention)

		// set the access token
		bot.setAccessToken(config.devBot.token)

		let err = false

		bot.api('me/messages', 'post', {
			recipient: '3710665022299286',
			message: {
				text: 'test'
			}
		}, (r)=>{

			expect(r).to.have.own.property("error")
			done()
		})
		
		
	})

})
