// testing dependancies
let expect = require('chai').expect
let test = it

describe("Test MongoDB functionality", ()=>{

	test("mongoDB should have database accessible using authentication credentials", async ()=>{

		// import config
		let config = require("config")
		
		// create mongoDB connection for querying
		let MongoClient = require('mongodb').MongoClient;

		// create client
		let client = new MongoClient(config.uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		});

		// connect to client
		await client.connect()

		let db = client.db("db")

		expect(typeof db).to.equal('object')		
		expect(db.databaseName).to.equal("db")		

	})

	test("mongoDB should have collections accessible using authentication credentials", async ()=>{

		// import config
		let config = require("config")
		
		// create mongoDB connection for querying
		let MongoClient = require('mongodb').MongoClient;

		// create client
		let client = new MongoClient(config.uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		});

		// connect to client
		await client.connect()

		let db = client.db("db")
		let collection = db.collection("collection")

		expect(typeof collection).to.equal('object')		
		expect(collection.collectionName).to.equal("collection")		

	})

	test("mongoDB should be able to insert data using authentication credentials", async ()=>{

		// import config
		let config = require("config")
		
		// create mongoDB connection for querying
		let MongoClient = require('mongodb').MongoClient;

		// create client
		let client = new MongoClient(config.uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		});

		// connect to client
		await client.connect()

		let db = client.db("db")
		let collection = db.collection("collection")

		let res = await collection.updateOne({
			id: 1
		}, {
			$set: {
				test: 'data'
			}
		}, {
			upsert: true
		})

		expect(res.result.ok).to.equal(1)		

	})

})
