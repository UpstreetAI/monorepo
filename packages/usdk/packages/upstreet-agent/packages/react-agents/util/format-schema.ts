import { z } from 'zod';
import dedent from 'dedent';
import type { ZodTypeAny } from 'zod';
import {
  ChatMessages,
  PendingActionMessage,
  ActiveAgentObject,
  GenerativeAgentObject,
  ActionMessage,
  ActionProps,
  ActionMessageEvent,
  ActionMessageEventData,
  ConversationObject,
  // TaskEventData,
  ActOpts,
  DebugOptions,
  ActionStep,
  ActionPropsAux,
  UniformPropsAux,
} from '../types';

//

const isAllowedAction = (action: ActionPropsAux, conversation?: ConversationObject, actOpts?: ActOpts) => {
  const forceAction = actOpts?.forceAction ?? null;
  const excludeActions = actOpts?.excludeActions ?? [];
  return action.conversation === conversation &&
    (forceAction === null || action.type === forceAction) &&
    !excludeActions.includes(action.type);
};
const getFilteredActions = (actions: ActionPropsAux[], conversation?: ConversationObject, actOpts?: ActOpts) => {
  return actions.filter(action => isAllowedAction(action, conversation, actOpts));
};
const makeActionSchema = (method: string, args: z.ZodType<object> = z.object({})) => {
  return z.object({
    method: z.literal(method),
    args,
  });
};
const formatAction = (action: ActionPropsAux) => {
  const {
    type,
    description,
    state,
    examples,
  } = action;

  const examplesJsonString = (examples ?? []).map((args) => {
    return JSON.stringify(
      {
        method: type,
        args,
      }
    );
  }).join('\n');

  return (
    type ? (
      dedent`
        * ${type}
      ` +
      '\n'
    ) : ''
  ) +
  (description ? (description + '\n') : '') +
  (state ? (state + '\n') : '') +
  (examplesJsonString
    ? (
      dedent`
        Examples:
        \`\`\`
      ` +
      '\n' +
      examplesJsonString +
      '\n' +
      dedent`
        \`\`\`
      `
    )
    : ''
  );
};

//

export const formatBasicSchema = ({
  actions,
  uniforms,
  conversation,
  actOpts,
}: {
  actions: ActionPropsAux[],
  uniforms: UniformPropsAux[],
  conversation?: ConversationObject,
  actOpts?: ActOpts,
}) => {
  const makeUnionSchema = (actions: ActionPropsAux[]) => {
    const actionSchemas: ZodTypeAny[] = getFilteredActions(actions, conversation, actOpts)
      .map(action => makeActionSchema(action.type, action.schema));
    if (actionSchemas.length >= 2) {
      return z.union([
        z.null(),
        ...actionSchemas as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
      ]);
    } else if (actionSchemas.length === 1) {
      return z.union([z.null(), actionSchemas[0]]);
    } else {
      return null;
    }
  };
  const makeObjectSchema = (uniforms: ActionPropsAux[]) => {
    const filteredUniforms = getFilteredActions(uniforms, conversation, actOpts);
    if (filteredUniforms.length > 0) {
      const o = {};
      for (const uniform of filteredUniforms) {
        o[uniform.type] = uniform.schema;
        // console.log('set uniform', uniform.name, printNode(zodToTs(uniform.schema).node));
      }
      return z.object(o);
    } else {
      return null;
    }
  };
  const actionSchema = makeUnionSchema(actions);
  const uniformsSchema = makeObjectSchema(uniforms);
  const o = {};
  if (actionSchema) {
    o['action'] = actionSchema;
  }
  if (uniformsSchema) {
    o['uniforms'] = uniformsSchema;
  }
  return z.object(o);
};

export const formatReactSchema = ({
  actions,
  uniforms,
  conversation,
  actOpts,
}: {
  actions: ActionPropsAux[],
  uniforms: UniformPropsAux[],
  conversation?: ConversationObject,
  actOpts?: ActOpts,
}) => {
  const makeUnionSchema = (actions: ActionPropsAux[]) => {
    const actionSchemas: ZodTypeAny[] = getFilteredActions(actions, conversation, actOpts)
      .map(action => makeActionSchema(action.type, action.schema));
    if (actionSchemas.length >= 2) {
      return z.union([
        z.null(),
        ...actionSchemas as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
      ]);
    } else if (actionSchemas.length === 1) {
      return z.union([z.null(), actionSchemas[0]]);
    } else {
      return null;
    }
  };
  const makeObjectSchema = (uniforms: ActionPropsAux[]) => {
    const filteredUniforms = getFilteredActions(uniforms, conversation, actOpts);
    if (filteredUniforms.length > 0) {
      const o = {};
      for (const uniform of filteredUniforms) {
        o[uniform.type] = uniform.schema;
        // console.log('set uniform', uniform.name, printNode(zodToTs(uniform.schema).node));
      }
      return z.object(o);
    } else {
      return null;
    }
  };
  const actionSchema = makeUnionSchema(actions);
  const uniformsSchema = makeObjectSchema(uniforms);
  const o = {};
  o['observation'] = z.string();
  o['thought'] = z.string();
  if (actionSchema) {
    o['action'] = actionSchema;
  }
  if (uniformsSchema) {
    o['uniforms'] = uniformsSchema;
  }
  return z.object(o);
  // throw new Error('formatReactSchema not implemented');
};

export const formatActionsPrompt = (actions: ActionPropsAux[], uniforms: UniformPropsAux[], conversation?: ConversationObject, actOpts?: ActOpts) => {
  const actionsString = getFilteredActions(actions, conversation, actOpts)
    .map(formatAction)
    .join('\n\n');
  const uniformsString = getFilteredActions(uniforms, conversation, actOpts)
    .map(formatAction)
    .join('\n\n');
  return [
    actionsString && (dedent`\
      ## Actions
      Here are the available actions you can take:
    ` + '\n\n' +
    actionsString),
    uniformsString && (dedent`\
      ## Uniforms
      Each action must also include the following additional keys (uniforms):
    ` + '\n\n' +
    uniformsString),
  ].filter(Boolean).join('\n\n');
};