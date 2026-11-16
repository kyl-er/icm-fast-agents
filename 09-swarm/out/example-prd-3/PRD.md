# PRD: Swarm view for the trace screen

> A short product requirements document for adding a swarm view to the trace screen (05-screen): one orchestrator node, one lane per worker agent, each lane showing the agent's task, progress and result.
>
> Written by a swarm of 3 agents, one section each. Plan: plan.json. Checks: report.json.

## Problem and Goal {.fa-section}
The trace screen currently draws agents as a flat graph. When a swarm of 3 to 24 agents is shown the graph becomes unreadable.

Goal: add a swarm view with one lane per worker agent, showing the agent's task, progress and result.

### Users and Use Cases {.fa-section}
- Live demo to a visitor
- Replay of a saved run
- Debugging a failed worker

## Functional Requirements {.fa-section}
1. FR-1. Display a separate lane for each worker agent.
2. FR-2. Show the agent's task text in the lane.
3. FR-3. Show progress state as a percentage.
4. FR-4. Show token counter and millisecond counter.
5. FR-5. Allow clicking a lane to open a fragment of the trace.
6. FR-6. Number each requirement with the FR- prefix.

### Input Data {.fa-section}
The view consumes trace format v2 events only: run_start, agent_spawn, llm_start, llm_end, tool_start, tool_end, run_end.

## Non-functional Requirements {.fa-section}
NFR-1. Render at 60 fps with up to 24 agents.  
NFR-2. Work offline on replay.  
NFR-3. Use plain black text on white background.  

### Out of Scope and Open Questions {.fa-section}
- No support for more than 24 agents.  
- How to handle dynamic agent addition after start.  

### Milestones and Acceptance {.fa-section}
- M1: Basic lane rendering. Acceptance: "M1 demo shows 3 lanes with static task text."  
- M2: Progress counters. Acceptance: "M2 demo shows token and ms counters updating in real time."  
- M3: Full interaction. Acceptance: "M3 demo shows clicking a lane opens the corresponding trace fragment."

