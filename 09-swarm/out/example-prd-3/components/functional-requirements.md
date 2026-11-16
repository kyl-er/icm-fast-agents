## Functional Requirements {.fa-section}
1. FR-1. Display a separate lane for each worker agent.
2. FR-2. Show the agent's task text in the lane.
3. FR-3. Show progress state as a percentage.
4. FR-4. Show token counter and millisecond counter.
5. FR-5. Allow clicking a lane to open a fragment of the trace.
6. FR-6. Number each requirement with the FR- prefix.

### Input Data {.fa-section}
The view consumes trace format v2 events only: run_start, agent_spawn, llm_start, llm_end, tool_start, tool_end, run_end.
