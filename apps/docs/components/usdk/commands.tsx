"use server";

import React from "react";

const Commands = async () => {
  let program;
  try {
    const createProgram = (await import('usdk/cli')).createProgram
    program = createProgram();
  }
  catch (error) {
    console.error("Could not create program in NextJS:", error);
  }

  // Generate table rows with subcommands and switches
  const commandTableRows = program?.commands.map((cmd) => {
    const subcommands = cmd.commands.length > 0 ? (
      <div>
        <strong>Subcommands:</strong>
        <ul>
          {cmd.commands.map((sub) => (
            <li key={sub.name()}>
              <code>{sub.name()}</code>: {sub.description()}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

    const switches = cmd.options.length > 0 ? (
      <div>
        <ul>
          {cmd.options.map((opt) => (
            <li key={opt.flags}>
              <code>{opt.flags}</code>: {opt.description || "No description available"}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

    return (
      <tr key={cmd.name()}>
        <td style={{ verticalAlign: "top", padding: "8px" }}>
          <code>{cmd.name()}</code>
        </td>
        <td style={{ verticalAlign: "top", padding: "8px" }}>
          {cmd.description()}
        </td>
        <td style={{ verticalAlign: "top", padding: "8px" }}>
          {subcommands}
          {switches}
        </td>
      </tr>
    );
  });

  return (
    <div>
      <table style={{ borderCollapse: "collapse", width: "100%", }}>
        <thead>
          <tr>
            <th style={{ padding: "8px", }}>Command</th>
            <th style={{ padding: "8px", width: '100%', }}>Description</th>
            <th style={{ padding: "8px", }}>Subcommands & Switches</th>
          </tr>
        </thead>
        <tbody>{commandTableRows}</tbody>
      </table>
    </div>
  );
};

export default Commands;
