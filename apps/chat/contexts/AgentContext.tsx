import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface Agent {
    id: number;
    user_id: string;
    type: string;
    name: string;
    description: string;
    preview_url: string;
    images: string[];
    start_url: string;
    version: string;
    origin: string;
}

interface AgentContextType {
    agents: Agent[];
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    deleteAgent: (id: number) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [agents, setAgents] = useState<Agent[]>([]);

    const deleteAgent = (id: number) => {
        setAgents(prevAgents => prevAgents.filter(agent => agent.id !== id));
    };

    return (
        <AgentContext.Provider value={{ agents, setAgents, deleteAgent }}>
            {children}
        </AgentContext.Provider>
    );
};

export const useAgents = () => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgents must be used within an AgentProvider');
    }
    return context;
};
