import {
  AgentObjectData,
  DataSourceConfig,
} from '../types';

export class AgentObject extends EventTarget {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  bio: string;
  previewUrl: string;
  model: string;
  smallModel: string;
  largeModel: string;
  features: string[];
  address: string;
  stripeConnectAccountId: string;
  dataSources?: Record<string, DataSourceConfig>;


  constructor(config: AgentObjectData) {
    super();
    this.setConfig(config);
  }
  setConfig({
    id,
    ownerId,
    name,
    description,
    bio,
    previewUrl,
    model,
    smallModel,
    largeModel,
    features,
    address,
    stripeConnectAccountId,
    dataSources,
  }: AgentObjectData) {
    this.id = id;
    this.ownerId = ownerId;
    this.name = name;
    this.description = description;
    this.bio = bio;
    this.previewUrl = previewUrl;
    this.model = model;
    this.smallModel = smallModel;
    this.largeModel = largeModel;
    this.features = features;
    this.address = address;
    this.stripeConnectAccountId = stripeConnectAccountId;
    this.dataSources = dataSources;
  }
}
