// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const axios = require('axios');
const Decimal = require('decimal.js');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Bonjour, bienvenue chez Amazon Paris 3ème édition';
        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
};
const CurrencyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CurrencyIntent';
    },
    async handle(handlerInput) {
        
        const slotValues = getSlotValues(handlerInput.requestEnvelope.request.intent.slots);
        
        const amount = slotValues.amount.resolved;
        const initCurrency = slotValues.initCurrency.statusCode === "ER_SUCCESS_MATCH" ? slotValues.initCurrency.id : undefined;
        const finalCurrency = slotValues.finalCurrency.statusCode === "ER_SUCCESS_MATCH" ? slotValues.finalCurrency.id : undefined;
        
        let rates = "";
        
        
        if (initCurrency) {
            rates = await getRate(initCurrency, finalCurrency);
        } else {
            return handlerInput.responseBuilder
            .speak('Je suis désolé, mais nous ne gérons pas cette devise')
            .getResponse();
        }
        
        let a = new Decimal(amount);
        let b = new Decimal(rates)
        
        const speakOutput = `${amount} ${slotValues.initCurrency.resolved} donne <say-as interpret-as="cardinal">${(a*b).toFixed(4)}</say-as> ${slotValues.finalCurrency.resolved}`;
        
        if (supportsAPL(handlerInput)) {
            
            handlerInput.responseBuilder
            .addDirective({
                type: 'Alexa.Presentation.APL.RenderDocument',
                document: require('./template-currency.json'),
                datasources: {
                    "data": {
                        "textPrimary": `${amount} ${slotValues.initCurrency.resolved}`,
                        "amount": `${(a*b).toFixed(2)}`,
                        "textSecondary": `${slotValues.finalCurrency.resolved}`
                    }
                }
            })
            ;
        } 
        
        return handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
        .getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';
        
        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;
        
        return handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
        .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;
        
        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
};


// Helpers


function getSlotValues(filledSlots) {
    const slotValues = {};
    
    Object.keys(filledSlots).forEach((item) => {
        const name = filledSlots[item].name;
        slotValues[name] = {};
        
        // Extract the nested key 'code' from the ER resolutions in the request
        let erStatusCode;
        try {
            erStatusCode = ((((filledSlots[item] || {}).resolutions ||
            {}).resolutionsPerAuthority[0] || {}).status || {}).code;
        } catch (e) {
            // console.log('erStatusCode e:' + e)
        }
        
        switch (erStatusCode) {
            case 'ER_SUCCESS_MATCH':
            slotValues[name].synonym = filledSlots[item].value;
            slotValues[name].resolved = filledSlots[item].resolutions
            .resolutionsPerAuthority[0].values[0].value.name;
            slotValues[name].isValidated = filledSlots[item].value ===
            filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name;
            slotValues[name].id = filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id;
            slotValues[name].statusCode = erStatusCode;
            break;
            
            default: // ER_SUCCESS_NO_MATCH, undefined
            slotValues[name].synonym = filledSlots[item].value;
            slotValues[name].resolved = filledSlots[item].value;
            slotValues[name].isValidated = false;
            slotValues[name].id = false;
            slotValues[name].statusCode = erStatusCode === undefined ? 'undefined' : erStatusCode;
            break;
        }
    }, this);
    
    return slotValues;
}

function supportsAPL(handlerInput) {
    const supportedInterfaces =
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces;
    const aplInterface = supportedInterfaces['Alexa.Presentation.APL'];
    return aplInterface != null && aplInterface != undefined;
}

const getRate = async (base, finalCurrency) => {
    console.log(`https://api.exchangeratesapi.io/latest?symbols=${finalCurrency}&base=${base}`);
    
    try {
        const response = await axios.get(`https://api.exchangeratesapi.io/latest?symbols=${finalCurrency}&base=${base}`);
        
        return response.data.rates[finalCurrency]
    } catch(error) {
        console.error(error);
    }
}

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
.addRequestHandlers(
    LaunchRequestHandler,
    CurrencyIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    ) 
    .addErrorHandlers(
        ErrorHandler,
        )
        .lambda();
        