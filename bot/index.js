
// Initialize
console.log("Starting Facebook Waste Management chatbot")

// Initialize API through chat api library 
const login = require("facebook-chat-api");

// Create simple echo bot
login({email: "FB_EMAIL", password: "FB_PASSWORD"}, (err, api) => {
    if(err) return console.error(err);

    api.listen((err, message) => {
        api.sendMessage(message.body, message.threadID);
    });
});