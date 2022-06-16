import * as cdk from '@aws-cdk/core';
import { ApplicationAPI } from './api';
import { AppDatabase } from './database';
import { AppServices } from './services';
import { AssetStorage } from './storage';
import { ApplicationEvents } from './events';
import { ApplicationAuth } from './auth';
import { DocumentProcessing } from './processing';
import { WebApp } from './webapp';
import { S3CloudTrail } from './storageCloudTrail';

export class ApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const storage = new AssetStorage(this, 'Storage');

    const auth = new ApplicationAuth(this, 'Auth');

    new S3CloudTrail(this, 'S3CloudTrail', {
      bucketToTrackUploads: storage.uploadBucket,
    })

    const database = new AppDatabase(this, 'Database');

    const services = new AppServices(this, 'Services', {
      documentsTable: database.documentsTable,
      uploadBucket: storage.uploadBucket,
      assetBucket: storage.assetBucket,
      userPool: auth.userPool,
    });

    const api = new ApplicationAPI(this, 'API', {
      commentsService: services.commentsService,
      documentService: services.documentsService,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      usersService: services.usersService,
    });

    const processing = new DocumentProcessing(this, 'Processing', {
      uploadBucket: storage.uploadBucket,
      assetBucket: storage.assetBucket,
      documentsTable: database.documentsTable,
    });

    new ApplicationEvents(this, 'Events', {
      uploadBucket: storage.uploadBucket,
      processingStateMachine: processing.processingStateMachine,
      notificationsService: services.notificationsService,
    })

    new WebApp(this, 'WebApp', {
      hostingBucket: storage.hostingBucket,
      baseDirectory: '../',
      relativeWebAppPath: 'webapp',
      httpApi: api.httpApi,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
    });
  }
}
