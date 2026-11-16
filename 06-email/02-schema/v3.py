"""Schema v3. Same extraction schema as v2. What changes is the shape of the decision:

v1 and v2 asked the decision model one five-way choice and wrote the precedence rules into the option text.
v3 asks four narrow yes/no questions (Noul) in one request and puts the precedence in code (`compose`).
The rule "bulk beats personal beats meeting beats action" is policy; it is now three lines of Python that
can be read, tested and changed without re-running a model. The four probabilities are reusable data.
"""
from v2 import (DIRECT_PROMPT, EXTRACT_PROMPT, FACTS_STATE_KEEPS_HEADERS, LABELS, Direct, EmailFacts,  # noqa: F401
                Meeting, Request, QUESTIONS_FACTS as _V2F)

VERSION = 'v3'
ORDER = ['bulk', 'personal', 'meeting', 'action']   # first one whose probability reaches 0.5 wins; otherwise `info`


def _nouls(subject):
    return {
        'bulk': {'type': 'noul', 'instructions': f'Is {subject} a newsletter, marketing email, automated or system-generated message, or an announcement sent to many people?',
                 'criteria': {'true': 'mass mail or machine-generated, even if it contains a call to action', 'false': 'a person wrote it for this recipient or a small named group'}},
        'personal': {'type': 'noul', 'instructions': f'Is {subject} about private life rather than work: family, friends, jokes, private plans, chit-chat?'},
        'meeting': {'type': 'noul', 'instructions': f'Is {subject} mainly about arranging a meeting, call or event with the recipient: an invitation, a time change, logistics?',
                    'criteria': {'true': 'its main point is scheduling or logistics', 'false': 'a meeting is absent or only mentioned in passing'}},
        'action': {'type': 'noul', 'instructions': f'Does a person ask the recipient of {subject} specifically to do something or to answer a question?',
                   'criteria': {'true': 'a request or question aimed at this recipient', 'false': 'nothing is asked, or only generic calls to action aimed at any reader'}},
        'needs_reply': _V2F['needs_reply'],
        'urgency': _V2F['urgency'],
    }


QUESTIONS_FACTS = _nouls('the email described by `facts` and `headers`')
QUESTIONS_RAW = _nouls('`email`')


def compose(ans):
    """Policy in code: answers -> the same output shape the choice-based versions give."""
    p = {k: ans[k]['noul'] for k in ORDER}
    label = next((k for k in ORDER if p[k] >= 0.5), 'info')
    # confidence: how far the deciding probabilities are from the 0.5 threshold (0 = coin flip, 1 = certain)
    used = ORDER[:ORDER.index(label) + 1] if label != 'info' else ORDER
    conf = min(abs(p[k] - 0.5) * 2 for k in used)
    return {'triage': label, 'confidence': round(conf, 2), 'probabilities': p}
