import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';

interface S3CloudTrailProps {
bucketToTrackUploads: s3.IBucket;
}

export class S3CloudTrail extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: S3CloudTrailProps) {
    super(scope, id);
        const trail = new cloudtrail.Trail(this, id)
        trail.addS3EventSelector([{
        bucket: props.bucketToTrackUploads,
        }]);
    }
}
