/*

    Comments Service

    This Lambda function handles all interactions for comments in the document
    management system application (create, delete, get).

*/

import {
    createRouter,
    RouterType,
    Matcher,
    validatePathVariables,
    validateBodyJSONVariables,
} from 'lambda-micro';
import { AWSClients, generateID } from '../common';

//Utilize the DynamoDB Document Client
const dynamoDB = AWSClients.dynamoDB();
const tableName = process.env.DYNAMO_DB_TABLE;

// Get the EventBridge client
const eventbridge = AWSClients.eventbridge();

const schemas = {
    createComment: require('./schemas/createComment.json'),
    deleteComment: require('./schemas/deleteComment.json'),
    getComments: require('./schemas/getComments.json'),
}

//----------------------------------------------------------------------------
// SERVICE FUNCTIONS
//---------------------------------------------------------------------------

//Get all comments for a document
const getAllCommentsForDocument = async (request, response) => {
    const params = {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': request.pathVariables.docid,
            ':sk': 'Comment',
        }
    }
    const results = await dynamoDB.query(params).promise();
    return response.output(results.Items, 200);
};

//Creates a new comment for a document
const createComment = async (request, response) => {
    const userId = 'fc4cec10-6ae4-435c-98ca-6964382fee77'; // Hard-coded until we put users in place
    const commentId = `Comment#${generateID()}`;
    const item = {
      PK: request.pathVariables.docid,
      SK: commentId,
      DateAdded: new Date().toISOString(),
      Owner: userId,
      ...JSON.parse(request.event.body),
    };
    const params = {
      TableName: tableName,
      Item: item,
      ReturnValues: 'NONE',
    };
    await dynamoDB.put(params).promise();
  
    // Send comment event using Eventbridge
    // This will allow us to connect into this event for notifications
    const detail = {
      documentId: request.pathVariables.docid,
      commentId,
    };
    const eventParams = {
      Entries: [
        {
          Detail: JSON.stringify(detail),
          DetailType: 'CommentAdded',
          EventBusName: 'com.globomantics.dms',
          Resources: [],
          Source: 'com.globomantics.dms.comments',
        },
      ],
    };
    await eventbridge.putEvents(eventParams).promise();
  
    return response.output(item, 200);
  };

//Deletes a comment
const deleteComment = async (request, response) => {
    const params = {
        TableName: tableName,
        Key: {
            PK: request.pathVariables.docid,
            SK: `Comment#${request.pathVariables.commentId}`,
        },
    };
    await dynamoDB.delete(params).promise();
    return response.output({}, 200);
};

//----------------------------------------------------------------------------
// LAMBDA ROUTER
//----------------------------------------------------------------------------

/*
    See the npm package "lambda-micro" to view:

    https://github.com/davidtucker/lambda-micro

*/
const router = createRouter(RouterType.HTTP_API_V2);

//Get all commments for a document
// GET /comments/(:docid)
router.add(
    Matcher.HttpApiV2('GET', '/comments/(:docid)'),
    validatePathVariables(schemas.getComments),
    getAllCommentsForDocument,
);

router.add(
    Matcher.HttpApiV2('POST', '/comments/(:docid)'),
    validateBodyJSONVariables(schemas.createComment),
    createComment,
);

router.add(
    Matcher.HttpApiV2('DELETE', '/comments/(:docid)/(:commentid)'),
    validatePathVariables(schemas.deleteComment),
    deleteComment,
);

//Lambda Handler
exports.handler = async (event, context) => {
    return router.run(event, context);
};