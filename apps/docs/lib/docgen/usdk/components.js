/*
 * @author SaadBazaz, ChatGPT
 * @link https://chatgpt.com/share/6751b4e9-ce8c-8011-bbff-b6aa094040c1 
 * @tutorial https://github.com/UpstreetAI/upstreet-core/pull/731
 * @description
 * Simply annotate each Component with a JSDoc string, with the following tags:
 * - @summary
 * - @description
 * - @param
 * - @returns
 * - @example
 * - @note (optional)
 * Also annotate your types. Learn how to here: https://fumadocs.vercel.app/docs/ui/typescript#navbarprops
 * 
 * @TODO Make this more robust and generic, for hooks and more.
*/

const fs = require('fs');
const path = require('path');
const doctrine = require('doctrine');
const _ = require('lodash');

// Path to the specific module in node_modules
const COMPONENTS_DIR = path.resolve(
  './node_modules/usdk/packages/upstreet-agent/packages/react-agents/components'
);
const TYPES_DIR = path.resolve(
  './node_modules/usdk/packages/upstreet-agent/packages/react-agents/types'
);
const OUTPUT_DIR = path.resolve('./content/docs/api/components-temp'); // Output directory

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to generate unique file names in case of conflicts
function getUniqueFilePath(basePath, extension) {
  if (!fs.existsSync(basePath + extension)) {
    return basePath + extension;
  }

  const timestamp = new Date().toISOString().replace(/[:.-]/g, ''); // Unique timestamp
  const diffPath = `${basePath}.diff`;
  if (!fs.existsSync(diffPath + extension)) {
    return diffPath + extension;
  }

  return `${diffPath}.${timestamp}${extension}`;
}

// Parse JSDoc comments from a file
function parseJSDoc(fileContent) {
  const comments = [];
  const regex = /\/\*\*([\s\S]*?)\*\//g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    comments.push(match[1]);
  }

  return comments.map((comment) => doctrine.parse(comment, { unwrap: true }));
}

// Parse TypeScript types from .d.ts files
function parseTypes(fileContent) {
  const types = [];
  const regex = /export\s+(interface|type)\s+(\w+)\s*[{]/g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    types.push({
      type: match[1],
      name: match[2],
    });
  }

  return types;
}

// Extract component name from the component file content (inferred from function or variable definition)
function getComponentName(fileContent) {
    // This regex specifically matches 'export const <variableName> ='
    const constRegex = /export\s+const\s+(\w+)\s*=\s*\(/;
  
    const match = fileContent.match(constRegex);
    if (match) return match[1];
  
    return null;
  }
  

// Generate MDX documentation
function generateMDX(filePath, currentTime) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const jsdocComments = parseJSDoc(fileContent);

  // Extract component name
  let componentName = getComponentName(fileContent);

  if (!componentName) {
    // Default to filename with first case upper
    componentName = _.upperFirst(_.camelCase(path.basename(filePath, path.extname(filePath))));
  }

  // Extract props and descriptions
  const props = jsdocComments
    .flatMap((comment) => comment.tags)
    .filter((tag) => tag.title === 'param' || tag.title === 'prop')
    .map((tag) => ({
      name: tag.name,
      description: tag.description || 'No description provided.',
      type: tag.type ? doctrine.type.stringify(tag.type) : 'unknown',
      default: tag.default || 'N/A',
    }));

  // Extract examples
  const examples = jsdocComments
    .flatMap((comment) => comment.tags)
    .filter((tag) => tag.title === 'example')
    .map((tag) => tag.description);

  const exampleSection = examples.length
    ? `## Usage\n\n${examples
        .map((example, idx) => `### Example ${idx + 1}\n\n${example.trim()}\n`)
        .join('\n\n')}`
    : `## Usage\n\nNo examples provided.`;

  // Generate other sections
  const summaryTag = jsdocComments
    .flatMap((comment) => comment.tags)
    .find((tag) => tag.title === 'summary');
  const shortSummary = summaryTag ? summaryTag.description.trim() : 'No short summary provided.';

  const descriptionTag = jsdocComments
    .flatMap((comment) => comment.tags)
    .find((tag) => tag.title === 'description');
  const longDescription = descriptionTag ? descriptionTag.description.trim() : 'No detailed explanation provided.';

  const noteTag = jsdocComments
    .flatMap((comment) => comment.tags)
    .find((tag) => tag.title === 'note');
  const note = noteTag ? noteTag.note.trim() : '';

  const importSnippet = `## Import

\`\`\`tsx
import { ${componentName} } from 'react-agents';
\`\`\``;

  const metadata = `---
title: <${componentName}>
description: ${shortSummary}
full: false
---
`;

  const updateComment = `{/*
 * Autogenerated by ${process.argv.join(' ')} on ${currentTime.toISOString()}
 * Please update this comment when regenerated.
*/}
`;

  const explanation = longDescription ? `\n\n${longDescription}` : '';

  const propsTable = `
## Props

<AutoTypeTable path="node_modules/usdk/packages/upstreet-agent/packages/react-agents/types/agents.d.ts" name="${componentName}Props" />  

// OR

import { TypeTable } from 'fumadocs-ui/components/type-table';
import type { ${componentName}Props } from 'react-agents/types';

export const ${componentName}Props = ${JSON.stringify(
    Object.fromEntries(
    props.map((prop) => [
        prop.name,
        {
        description: prop.description,
        type: prop.type,
        typeDescription: 'N/A', // Adjust type descriptions dynamically if needed
        typeDescriptionLink: '',
        default: prop.default,
        },
    ])
    ),
    null,
    2
)};

<TypeTable type={${componentName}Props} />
`;

  const sourceCode = `## Source code

You can see the code for the \`<${componentName}>\` Component in our [GitHub](${'https://github.com/UpstreetAI/upstreet-core/blob/main/packages/usdk/packages/upstreet-agent/packages/react-agents/components/' + _.kebabCase(componentName) + '.tsx'}).
`;

  const content = [
    metadata,
    updateComment,
    explanation.trim(),
    importSnippet,
    exampleSection,
    propsTable,
    sourceCode,
    note,
  ]
    .filter(Boolean)
    .join('\n\n');

  const outputFilePath = getUniqueFilePath(
    path.join(OUTPUT_DIR, _.kebabCase(componentName)),
    '.mdx'
  );
  fs.writeFileSync(outputFilePath, content, 'utf-8');
  console.log(`✅ Generated documentation for ${componentName} at ${outputFilePath}`);
}

// Process all component files
function processComponents() {
  const componentFiles = fs.readdirSync(COMPONENTS_DIR).filter((file) => file.endsWith('.tsx'));
  
  const currentTime = new Date();

  componentFiles.forEach((file) => {
    const fullPath = path.join(COMPONENTS_DIR, file);
    generateMDX(fullPath, currentTime);
  });
}

// Start processing
processComponents();
