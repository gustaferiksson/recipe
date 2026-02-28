import * as cdk from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import type { Construct } from "constructs"

export class RecipeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const region = this.region

        // IAM user for the local server to authenticate with Bedrock
        const user = new iam.User(this, "RecipeUser", {
            userName: "recipe",
        })

        // Bedrock policy: MiniMax M2.1 for the edit agent, Nova Lite for parsing and utility tasks
        user.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
                resources: [
                    `arn:aws:bedrock:${region}::foundation-model/minimax.minimax-m2.1`,
                    `arn:aws:bedrock:${region}::foundation-model/amazon.nova-lite-v1:0`,
                ],
            })
        )

        // Outputs
        new cdk.CfnOutput(this, "UserArn", {
            value: user.userArn,
            description: "ARN of the recipe IAM user",
        })

        new cdk.CfnOutput(this, "NextStep", {
            value: `aws iam create-access-key --user-name recipe --profile ${process.env.AWS_PROFILE ?? "default"}`,
            description: "Run this to generate access keys for the user",
        })
    }
}
