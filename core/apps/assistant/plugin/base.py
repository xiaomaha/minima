from typing import TypedDict

from apps.assistant.agent.factory import create_agent


class UsageInfo(TypedDict):
    input_tokens: int
    output_tokens: int


class BasePlugin:
    def __init__(self):
        self.agent = create_agent()
