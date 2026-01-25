from abc import ABC, abstractmethod
from typing import AsyncIterator, TypedDict


class LastUsageType(TypedDict):
    input_tokens: int | None
    output_tokens: int | None


class BaseAgent(ABC):
    def __init__(self, api_key: str):
        self.api_key: str = api_key
        self.last_usage: LastUsageType | None = None

    @abstractmethod
    async def generate_stream(
        self,
        message: str,
        context: list[dict] | None = None,
        system_instruction: str | None = None,
        parts: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        yield ""
