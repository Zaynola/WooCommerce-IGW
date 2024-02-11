import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as aws from 'aws-sdk';
import { Construct } from 'constructs';

interface IGWStackProps extends cdk.StackProps {
  vpcTagName: string;
}

export class IGWStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IGWStackProps) {
    super(scope, id, props);

    // Call the async method
    this.createResources(props.vpcTagName);
  }

  private async createResources(vpcTagName: string) {
    // this uses the VPC tag name passed as a property
    const ec2Client = new aws.EC2();

    try {
      const vpcsResponse = await ec2Client.describeVpcs({
        Filters: [
          {
            Name: 'tag-key',
            Values: [`${vpcTagName}*`],
          },
        ],
      }).promise();

      const vpcs = vpcsResponse.Vpcs;

      if (!vpcs || vpcs.length === 0) {
        throw new Error(`No VPC found with the tag ${vpcTagName}`);
      }

      // it uses the first matching VPC found
      const firstVpc = vpcs[0];

      if (!firstVpc || !firstVpc.VpcId) {
        throw new Error(`VPC ID is undefined or empty`);
      }

      const existingVpc = ec2.Vpc.fromVpcAttributes(this, 'ExistingVPC', {
        vpcId: firstVpc.VpcId,
        availabilityZones: ['ca-central-1a', 'ca-central-1b', 'ca-central-1d'],
        publicSubnetIds: [
          'BmoWooCommerceStack/BMO-WooCommerce-VPC/public-subnetSubnet1',
          'BmoWooCommerceStack/BMO-WooCommerce-VPC/public-subnetSubnet2',
          'BmoWooCommerceStack/BMO-WooCommerce-VPC/public-subnetSubnet3',
        ],
      });

      // Create an Internet Gateway
      const igw = new ec2.CfnInternetGateway(this, 'BMOWooCommerceIGW', {
        tags: [{ key: 'Name', value: 'BMO-WooCommerce-IGW' }],
      });

      // Attach the Internet Gateway to the existing VPC if it exists
      const vpcId = existingVpc.vpcId;
      if (vpcId) {
        const igwAttachment = new ec2.CfnVPCGatewayAttachment(this, 'BMOWooCommerceIGWAttachment', {
          vpcId: vpcId,
          internetGatewayId: igw.ref,
        });

        // Output the VPC ID
        new cdk.CfnOutput(this, 'VpcId', {
          value: vpcId,
        });

        // Create a security group for the bastion host
        const bastionHostSecurityGroup = new ec2.SecurityGroup(this, 'BMOBastionHostSG', {
          vpc: existingVpc,
          securityGroupName: 'BMO-Bastion-Host-SG',
          description: 'Security group for the BMO Bastion Host',
        });

        bastionHostSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');

        // Create the bastion host instance
        const bastionHost = new ec2.Instance(this, 'BMOBastionHost', {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
          machineImage: ec2.MachineImage.latestAmazonLinux({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
          vpc: existingVpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
          securityGroup: bastionHostSecurityGroup,
          keyName: 'test2.pem'
        });

        // Tag the bastion host instance
        cdk.Tags.of(bastionHost).add('Name', 'BMO-Bastion-Host');
      }

    } catch (error) {
      console.error('Error:', error);
    }
  }
}