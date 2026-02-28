#!/usr/bin/env node
import "aws-cdk-lib/region-info"
import * as cdk from "aws-cdk-lib"
import { RecipeStack } from "../lib/recipe-stack"

const account = process.env.AWS_ACCOUNT
const region = process.env.AWS_REGION ?? "eu-west-1"

if (!account) {
    throw new Error("AWS_ACCOUNT env var is required (your AWS account ID)")
}

const app = new cdk.App()

new RecipeStack(app, "RecipeStack", {
    env: { account, region },
})
