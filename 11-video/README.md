# 11-video: 8-bit explainer film

A 40 s, silent, 9:16 film about how the icm-fast-agents demo works, made with the existing bitfield studio
(`~/03-Projects/media/bitfield`, plan format in its `PLAN.md`). No new renderer code: the film is one JSON plan.

Files
- `icm-fast-agents.plan.json`: the film (7 scenes, captions, layers). This is the source.
- `icm-fast-agents.mp4`: the export, h264, 1080x1920, 30 fps, 40.0 s, 9.5 MB, no audio track.
- `contact-sheet.png`: 3 frames per scene, from the studio preview.

## Re-render

```
cd ~/03-Projects/media/bitfield
python3 studio.py validate ~/03-Projects/ai-infra/icm-fast-agents/11-video/icm-fast-agents.plan.json
python3 studio.py preview  ~/03-Projects/ai-infra/icm-fast-agents/11-video/icm-fast-agents.plan.json   # writes renders/icm-fast-agents/sheet.png
mkdir -p ~/03-Projects/ai-infra/icm-fast-agents/11-video/work
python3 studio.py render   ~/03-Projects/ai-infra/icm-fast-agents/11-video/icm-fast-agents.plan.json --job ~/03-Projects/ai-infra/icm-fast-agents/11-video/work
# output: work/icm-fast-agents.mp4 and work/sheet.png (work/ is git-ignored)
```
Headless: no Ghostty window or desktop session is needed. Rendering took about 70 s on this machine.

## What I ran and saw

- `validate`: valid, 7 scenes, 40.0 s. Two `preview` passes; I looked at the contact sheet both times. The first showed
  the left bar in scene 6 missing (full-frame layers default to `over`; fixed with `"blend": "add"`) and the
  folder bars colliding with the top caption (moved down). Second sheet looked right.
- `render`: finished, state done. `ffprobe`: h264 1080x1920, 30 fps, 40.000 s, 9,419,909 bytes.
- I extracted frames from the final mp4 with ffmpeg and looked at them (t=33 s: bar chart with caption; t=38.5 s:
  torus and "Watch it work."). The frame at t=36.0 s is fully black (fade between scenes, expected).
  I did not watch the whole video play; the other scenes were checked only on the contact sheet.

## Scenes and the facts used

1. Title: "Small fast models. A tiny harness." (tesseract)
2. "The folder is the program. Ten numbered folders." Ten bars appear (README: 01-config to 10-decide). The tenth bar
   renders thinner than the others (clipped at the field boundary); not fixed.
3. "A 750-token prompt. One card per command." (life automaton as texture; README: about 750 tokens, one card per command)
4. "Every call is one JSON line. Lines become a graph of nodes." (reused the bitfield neuron-network clip, white)
5. "Email triage: a fast model extracts. A decision model decides in about 180 ms." (RESULTS.md: Jev alone median
   about 182-189 ms; the two-model route is about 1.6 s overall, so the caption is about the decision step only.)
6. "After three rounds. 65% to 82% on unseen mail." The numbers are the held-out 60-email two-model route, first
   schema (v1) vs final schema (v3), per RESULTS.md. Labels were written by an AI, not a person.
7. "Watch it work." (end card)

## Decisions (owner asleep)

- Used the studio JSON plan route, not `film.py`: headless, validated, no code.
- Look: grey/white only, one dither, no colour burst.
- Rendered into this folder through `--job`; `preview` wrote its sheet into the bitfield project's own
  `renders/icm-fast-agents/` (the studio's fixed output dir). That is a new subfolder; no existing bitfield file
  was modified.

## Stubbed / not done

- No voice-over (no Deepgram key) and no music: silent, captions only.
- The "folders" scene shows ten plain bars, not their names; no folder names are drawn.
- Scene 4's "lines turn into nodes" is the stock neuron-network clip, a stand-in for the real trace graph.
- Nothing needed an interactive desktop session. Live playback (`studio.py play`) needs the Ghostty viewer; not tried.

## Revision 2 (05:29)

Caption fixes per coordinator: ten folders (ten bars) and "After three rounds." Re-ran validate (7 scenes, 40.0 s), preview
(looked at the sheet), render (done, 1080x1920, 40.000 s, 9,469,920 bytes). Extracted the frame at t=9 s and looked at it:
ten bars, correct caption. Scene 6 checked on the contact sheet only.
