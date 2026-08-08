/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_conversation from "../agent/conversation.js";
import type * as agent_embeddingsCache from "../agent/embeddingsCache.js";
import type * as agent_memory from "../agent/memory.js";
import type * as aiTown_agent from "../aiTown/agent.js";
import type * as aiTown_agentDescription from "../aiTown/agentDescription.js";
import type * as aiTown_agentInputs from "../aiTown/agentInputs.js";
import type * as aiTown_agentOperations from "../aiTown/agentOperations.js";
import type * as aiTown_conversation from "../aiTown/conversation.js";
import type * as aiTown_conversationMembership from "../aiTown/conversationMembership.js";
import type * as aiTown_game from "../aiTown/game.js";
import type * as aiTown_ids from "../aiTown/ids.js";
import type * as aiTown_inputHandler from "../aiTown/inputHandler.js";
import type * as aiTown_inputs from "../aiTown/inputs.js";
import type * as aiTown_insertInput from "../aiTown/insertInput.js";
import type * as aiTown_location from "../aiTown/location.js";
import type * as aiTown_main from "../aiTown/main.js";
import type * as aiTown_movement from "../aiTown/movement.js";
import type * as aiTown_player from "../aiTown/player.js";
import type * as aiTown_playerDescription from "../aiTown/playerDescription.js";
import type * as aiTown_simulationControl from "../aiTown/simulationControl.js";
import type * as aiTown_simulationInputs from "../aiTown/simulationInputs.js";
import type * as aiTown_world from "../aiTown/world.js";
import type * as aiTown_worldMap from "../aiTown/worldMap.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as engine_abstractGame from "../engine/abstractGame.js";
import type * as engine_historicalObject from "../engine/historicalObject.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as launchTown_behavior from "../launchTown/behavior.js";
import type * as launchTown_behaviorActions from "../launchTown/behaviorActions.js";
import type * as launchTown_behaviorPolicy from "../launchTown/behaviorPolicy.js";
import type * as launchTown_bolnaOutboundClient from "../launchTown/bolnaOutboundClient.js";
import type * as launchTown_browserOrchestration from "../launchTown/browserOrchestration.js";
import type * as launchTown_browserRunModel from "../launchTown/browserRunModel.js";
import type * as launchTown_browserRunPolicy from "../launchTown/browserRunPolicy.js";
import type * as launchTown_browserRunner from "../launchTown/browserRunner.js";
import type * as launchTown_influence from "../launchTown/influence.js";
import type * as launchTown_influenceActions from "../launchTown/influenceActions.js";
import type * as launchTown_influenceModel from "../launchTown/influenceModel.js";
import type * as launchTown_outboundCallActions from "../launchTown/outboundCallActions.js";
import type * as launchTown_outboundCallModel from "../launchTown/outboundCallModel.js";
import type * as launchTown_outboundCallPolicy from "../launchTown/outboundCallPolicy.js";
import type * as launchTown_productAnalyzer from "../launchTown/productAnalyzer.js";
import type * as launchTown_productInput from "../launchTown/productInput.js";
import type * as launchTown_productModel from "../launchTown/productModel.js";
import type * as launchTown_products from "../launchTown/products.js";
import type * as launchTown_reportArtifactValidator from "../launchTown/reportArtifactValidator.js";
import type * as launchTown_reportData from "../launchTown/reportData.js";
import type * as launchTown_reportGeneration from "../launchTown/reportGeneration.js";
import type * as launchTown_reportGenerationPolicy from "../launchTown/reportGenerationPolicy.js";
import type * as launchTown_scenario from "../launchTown/scenario.js";
import type * as launchTown_simulationLifecycle from "../launchTown/simulationLifecycle.js";
import type * as launchTown_simulationRunModel from "../launchTown/simulationRunModel.js";
import type * as launchTown_types from "../launchTown/types.js";
import type * as launchTown_validators from "../launchTown/validators.js";
import type * as launchTown_voiceAgentConfig from "../launchTown/voiceAgentConfig.js";
import type * as launchTown_voiceContext from "../launchTown/voiceContext.js";
import type * as launchTown_voiceModel from "../launchTown/voiceModel.js";
import type * as messages from "../messages.js";
import type * as testing from "../testing.js";
import type * as util_FastIntegerCompression from "../util/FastIntegerCompression.js";
import type * as util_assertNever from "../util/assertNever.js";
import type * as util_asyncMap from "../util/asyncMap.js";
import type * as util_compression from "../util/compression.js";
import type * as util_geometry from "../util/geometry.js";
import type * as util_isSimpleObject from "../util/isSimpleObject.js";
import type * as util_llm from "../util/llm.js";
import type * as util_minheap from "../util/minheap.js";
import type * as util_object from "../util/object.js";
import type * as util_sleep from "../util/sleep.js";
import type * as util_types from "../util/types.js";
import type * as util_xxhash from "../util/xxhash.js";
import type * as world from "../world.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/conversation": typeof agent_conversation;
  "agent/embeddingsCache": typeof agent_embeddingsCache;
  "agent/memory": typeof agent_memory;
  "aiTown/agent": typeof aiTown_agent;
  "aiTown/agentDescription": typeof aiTown_agentDescription;
  "aiTown/agentInputs": typeof aiTown_agentInputs;
  "aiTown/agentOperations": typeof aiTown_agentOperations;
  "aiTown/conversation": typeof aiTown_conversation;
  "aiTown/conversationMembership": typeof aiTown_conversationMembership;
  "aiTown/game": typeof aiTown_game;
  "aiTown/ids": typeof aiTown_ids;
  "aiTown/inputHandler": typeof aiTown_inputHandler;
  "aiTown/inputs": typeof aiTown_inputs;
  "aiTown/insertInput": typeof aiTown_insertInput;
  "aiTown/location": typeof aiTown_location;
  "aiTown/main": typeof aiTown_main;
  "aiTown/movement": typeof aiTown_movement;
  "aiTown/player": typeof aiTown_player;
  "aiTown/playerDescription": typeof aiTown_playerDescription;
  "aiTown/simulationControl": typeof aiTown_simulationControl;
  "aiTown/simulationInputs": typeof aiTown_simulationInputs;
  "aiTown/world": typeof aiTown_world;
  "aiTown/worldMap": typeof aiTown_worldMap;
  constants: typeof constants;
  crons: typeof crons;
  "engine/abstractGame": typeof engine_abstractGame;
  "engine/historicalObject": typeof engine_historicalObject;
  http: typeof http;
  init: typeof init;
  "launchTown/behavior": typeof launchTown_behavior;
  "launchTown/behaviorActions": typeof launchTown_behaviorActions;
  "launchTown/behaviorPolicy": typeof launchTown_behaviorPolicy;
  "launchTown/bolnaOutboundClient": typeof launchTown_bolnaOutboundClient;
  "launchTown/browserOrchestration": typeof launchTown_browserOrchestration;
  "launchTown/browserRunModel": typeof launchTown_browserRunModel;
  "launchTown/browserRunPolicy": typeof launchTown_browserRunPolicy;
  "launchTown/browserRunner": typeof launchTown_browserRunner;
  "launchTown/influence": typeof launchTown_influence;
  "launchTown/influenceActions": typeof launchTown_influenceActions;
  "launchTown/influenceModel": typeof launchTown_influenceModel;
  "launchTown/outboundCallActions": typeof launchTown_outboundCallActions;
  "launchTown/outboundCallModel": typeof launchTown_outboundCallModel;
  "launchTown/outboundCallPolicy": typeof launchTown_outboundCallPolicy;
  "launchTown/productAnalyzer": typeof launchTown_productAnalyzer;
  "launchTown/productInput": typeof launchTown_productInput;
  "launchTown/productModel": typeof launchTown_productModel;
  "launchTown/products": typeof launchTown_products;
  "launchTown/reportArtifactValidator": typeof launchTown_reportArtifactValidator;
  "launchTown/reportData": typeof launchTown_reportData;
  "launchTown/reportGeneration": typeof launchTown_reportGeneration;
  "launchTown/reportGenerationPolicy": typeof launchTown_reportGenerationPolicy;
  "launchTown/scenario": typeof launchTown_scenario;
  "launchTown/simulationLifecycle": typeof launchTown_simulationLifecycle;
  "launchTown/simulationRunModel": typeof launchTown_simulationRunModel;
  "launchTown/types": typeof launchTown_types;
  "launchTown/validators": typeof launchTown_validators;
  "launchTown/voiceAgentConfig": typeof launchTown_voiceAgentConfig;
  "launchTown/voiceContext": typeof launchTown_voiceContext;
  "launchTown/voiceModel": typeof launchTown_voiceModel;
  messages: typeof messages;
  testing: typeof testing;
  "util/FastIntegerCompression": typeof util_FastIntegerCompression;
  "util/assertNever": typeof util_assertNever;
  "util/asyncMap": typeof util_asyncMap;
  "util/compression": typeof util_compression;
  "util/geometry": typeof util_geometry;
  "util/isSimpleObject": typeof util_isSimpleObject;
  "util/llm": typeof util_llm;
  "util/minheap": typeof util_minheap;
  "util/object": typeof util_object;
  "util/sleep": typeof util_sleep;
  "util/types": typeof util_types;
  "util/xxhash": typeof util_xxhash;
  world: typeof world;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
