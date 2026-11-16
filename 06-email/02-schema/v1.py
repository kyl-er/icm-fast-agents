"""Schema v1: the first attempt. Extraction schema, extraction prompt, and the decision questions that read it.

The schema is designed backwards from the decision model: Jev answers narrow typed questions over named JSON
fields, so every field here is something one of the QUESTIONS below needs as evidence.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field

VERSION = 'v1'
LABELS = {
    'action': 'the sender asks the recipient to do something or to answer a question',
    'meeting': 'the email is about scheduling or logistics of a meeting, call or event',
    'info': 'work information with nothing asked of the recipient: a report, status, FYI or forwarded material',
    'bulk': 'a newsletter, automated notification or announcement sent to many people',
    'personal': 'not about work: family, friends, jokes, private plans',
}


class Request(BaseModel):
    what: str = Field(description='What the sender asks for, in at most 12 words')
    deadline: Optional[str] = Field(None, description='Deadline as written in the email, or null')


class EmailFacts(BaseModel):
    """Facts read from one email. Only what the text supports."""
    summary: str = Field(description='One sentence: what this email is')
    sender_kind: Literal['person', 'automated_system', 'mailing_list', 'unknown'] = Field(description='Who or what sent it')
    audience: Literal['one_person', 'small_group', 'many_people', 'unknown'] = Field(description='How many people it is addressed to')
    requests: list[Request] = Field(default_factory=list, description='Things the sender asks the recipient to do. Empty if none')
    questions: list[str] = Field(default_factory=list, description='Direct questions asked of the recipient. Empty if none')
    meeting: Optional[str] = Field(None, description='Meeting, call or event being arranged: what and when. Null if none')
    work_related: bool = Field(description='True if the email is about work')


EXTRACT_PROMPT = """Read the email and fill in the fields. Use only what the email says. Keep text fields short.
The recipient is the person whose mailbox this is."""

# Decision questions over the extracted facts (state = {"facts": EmailFacts}).
QUESTIONS_FACTS = {
    'triage': {'type': 'choice', 'instructions': 'What should the recipient do with the email described by `facts`?', 'criteria': LABELS},
    'needs_reply': {'type': 'noul', 'instructions': 'Does the sender expect the recipient to write back?'},
    'urgency': {'type': 'score', 'instructions': 'How soon does the recipient need to deal with this email?',
                'criteria': ['never: nothing to do', 'some time: no deadline', 'this week', 'today or tomorrow']},
}
# The same questions over the raw email (state = {"email": {...}}), for the decision model alone.
QUESTIONS_RAW = {
    'triage': {**QUESTIONS_FACTS['triage'], 'instructions': 'What should the recipient do with `email`?'},
    'needs_reply': QUESTIONS_FACTS['needs_reply'],
    'urgency': QUESTIONS_FACTS['urgency'],
}


class Direct(BaseModel):
    """The no-decision-model baseline: the fast LLM answers the three questions itself."""
    triage: Literal['action', 'meeting', 'info', 'bulk', 'personal']
    needs_reply: bool
    urgency: Literal[0, 1, 2, 3] = Field(description='0 never, 1 some time, 2 this week, 3 today or tomorrow')


DIRECT_PROMPT = 'Triage this email for its recipient.\n' + '\n'.join(f'- {k}: {v}' for k, v in LABELS.items())
