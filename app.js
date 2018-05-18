/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

var fs = require('fs');
var intentsConfigObj = JSON.parse(fs.readFileSync('intents-config.json', 'utf8'));
var http = require('https');
var intentFulfillmentObj = {
    //"Track Order": require('./intents/track_order')
};
// Action binding
//var LuisActions = require("botbuilder-luis-actionbinding");

var LuisActions = require('./core');
var SampleActions = require('./all.js');

// Setup Restify Server asd 123  12456
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Add a dialog for each intent that the LUIS app recognizes.  
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector).set('storage', inMemoryStorage); // Register in memory storage
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intentDialog = bot.dialog('/', new builder.IntentDialog({ recognizers: [recognizer] })
    .onDefault(DefaultReplyHandler));
bot.recognizer(recognizer);

//Action binding to bot 
LuisActions.bindToBotDialog(bot, intentDialog, LuisModelUrl, SampleActions,{
    defaultReply: DefaultReplyHandler,
    fulfillReply: FulfillReplyHandler,
    onContextCreation: onContextCreationHandler
});

function DefaultReplyHandler(session) {
    session.endDialog(
        'Sorry, I could not understand and am still learning. Please contact Zebra representatives during working hours.');
}

function FulfillReplyHandler(session, actionModel) {
    session.endDialog(actionModel.result.toString());
}

function onContextCreationHandler(action, actionModel, next, session) {
    if (action.intentName === 'Track Order') {
        if (!actionModel.parameters.optionChoosed) {
            actionModel.parameters.optionChoosed = '1';
        }
    }
    next();
}


/*bot.dialog('GreetingDialog',
    (session) => {
        //session.send("Hi I'm Virtual Assistant residing in your Order Management Portal. How can I help you today? \nType any of the options below  to start the conversation:\n\nTrack My Order \nProduct Availability \nStatus of Sales Order \nExport Open Orders \nExport Orders \nShow Order Details");
        session.send('You reached the Greeting intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('HelpDialog',
    (session) => {
        session.send('You reached the Help intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
})*/


for(var intent in intentsConfigObj){
    if(intentsConfigObj.hasOwnProperty(intent)){       
         addDialogForIntent(intent);    
    }
}

function addDialogForIntent(intentName){
    var fnArr = [handlePrompt];
    bot.dialog(''+intentName+'Dialog',fnArr).triggerAction({ 
        matches: ''+intentName        
    });
    function handlePrompt(session, args, next){
        var intent = args.intent;             
        session.privateConversationData.entityValues = session.privateConversationData.entityValues ? session.privateConversationData.entityValues :null;
        session.privateConversationData.entityKey = session.privateConversationData.entityKey || null;
        //builder.Prompts.text(session, " Key: "+session.privateConversationData.entityKey +" "+ JSON.stringify(args));
        if(intentsConfigObj[intentName].entities){
            if(session.privateConversationData.entityValues == null){
                session.privateConversationData.entityValues = {};
                for(var entity in intentsConfigObj[intentName].entities){
                    if(intentsConfigObj[intentName].entities.hasOwnProperty(entity)){                             
                        var value = builder.EntityRecognizer.findEntity(intent.entities, ''+entity);
                        session.privateConversationData.entityValues[entity] = value ? value.entity : null;                      
                    }                        
                }
            }
        
            if( session.privateConversationData.entityKey !=null){
                //add validations for entitiess
                session.privateConversationData.entityValues[session.privateConversationData.entityKey] = session.message.text;                    
            }
            
            session.privateConversationData.entityKey = null;
            
            for(var promptEntity in session.privateConversationData.entityValues){
                if(session.privateConversationData.entityValues.hasOwnProperty(promptEntity) && session.privateConversationData.entityValues[promptEntity] == null){
                    session.privateConversationData.entityKey = promptEntity;
                    break;
                }
            }
            
            if(session.privateConversationData.entityKey == null){ 
                //perform intent action and provide result 1234
                fnArr = [handlePrompt];                
                var temp = session.privateConversationData.entityValues;
                delete session.privateConversationData.entityValues;
                //session.endDialog(''+intentsConfigObj[intentName].response+' entities:'+JSON.stringify(temp));
                fulFillIntent(session,intentName,temp);
            }else{
                fnArr.push(handlePrompt);
                builder.Prompts.text(session, ''+intentsConfigObj[intentName].entities[session.privateConversationData.entityKey].prompt );
            }            
        }else{
             session.endDialog(''+intentsConfigObj[intentName].response);
        }
    }  
}

function fulFillIntent(session,intentName,entityValues){
    var actionType = intentsConfigObj[intentName].action.type;
    switch(actionType){
        case "CallWebService":
            callWebService(session,intentName,entityValues);
            break;
        case "IntentObject":
            var entities = intentsConfigObj[intentName].entities;
            intentFulfillmentObj[intentName].fulFill(session,entities,entityValues);
            break;   
        default:
            session.endDialog(''+intentsConfigObj[intentName].response);       
    }    
}

//Call web service123456789014545
function callWebService(session,intentName,entityValues){    
    var options = intentsConfigObj[intentName].action.RESTAPIOptions;
    var jsonObj = intentsConfigObj[intentName].action.defaultParam || {};
    var entities = intentsConfigObj[intentName].entities;
    for(var entity in entityValues){
        if(entityValues.hasOwnProperty(entity)){
           jsonObj[entities[entity].ParamName] = entityValues[entity];
        }
    }
    
    var req = http.request(options);
    req.on('response', function(res) {
        var chunks = [];
        
        res.on("data", function (chunk) {
         chunks.push(chunk);
        });
        
        res.on("end", function () {
            var body = Buffer.concat(chunks);
            console.log("Got response: " + body.toString());
            //context.succeed(body.toString());
            var jObj = JSON.parse(body.toString());
            
            if(jObj.OutputParameters){
                var items = jObj.OutputParameters.P_OUTPUT_TBL.P_INPUT_TBL_ITEM;
                var validItems = [];
                for(var item in items){
                    if(items.hasOwnProperty(item)){
                        var it = {};
                        it.carrier = items[item].C_ARGUMENT1;
                        it.trackingId = items[item].C_ARGUMENT2;
                        validItems.push(it);
                    }
                }            
                session.endDialog('For the given delivery id, we have '+items.length+' tracking ids as below: \n'+JSON.stringify(validItems));
            }else{
                session.endDialog('Result of service: \n'+body.toString());
            }
        });
    });
    req.on('error', function(e) {
        console.log("Got error: " + e.message);
        session.endDialog("Got error: " + e.toString());
    });
    req.write(JSON.stringify(jsonObj));
    req.end();
}