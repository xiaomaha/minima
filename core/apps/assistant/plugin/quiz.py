"""
Quiz generation from subtitle text using AI.

Token estimation for subtitle content:
- Average 20-30 min video → ~15,000-30,000 characters → ~22,500-60,000 tokens
- 1 hour video → ~40,000-70,000 characters → ~60,000-140,000 tokens
- Max 2 hours → ~95,000 characters → ~142,500-190,000 tokens

Gemini 2.5 Flash Lite has 1M token context window, so full subtitle content can be processed.

Question count strategy:
- 1 question per 3 minutes of content
- Min: 5 questions, Max: 30 questions
"""

import json
import logging
import re

from apps.assistant.plugin.base import BasePlugin

log = logging.getLogger(__name__)


SYSTEM_INSTRUCTION = """You are a quiz generator. Generate multiple-choice questions based on the provided content.

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    {
      "question": "question text",
      "supplement": "supplement text (optional, HTML markup allowed)",
      "options": ["option1", "option2", "option3", "option4"],
      "correct_answer": 0,
      "explanation": "explanation text"
    }
  ]
}

Requirements:
- Each question must have 4-6 options
- supplement is optional, can include HTML markup for additional context
- correct_answer is 0-indexed (0 = first option, 1 = second option, etc.)
- correct_answer must be between 0 and (number of options - 1)
- Cover main topics and key concepts from the content
- Return pure JSON without markdown formatting"""


class QuizMaker(BasePlugin):
    async def create_quiz_from_text(
        self, *, text: str, title: str, description: str, question_count: int, language: str
    ):
        prompt = f"""Generate {question_count} quiz questions in {language} from this content.

Media Title: {title}
Description: {description}

Subtitle Content:
{text}"""

        response_text = ""
        async for chunk in self.agent.generate_stream(message=prompt, system_instruction=SYSTEM_INSTRUCTION):
            response_text += chunk

        response_text = response_text.strip()
        response_text = re.sub(r"^```json\s*", "", response_text)
        response_text = re.sub(r"\s*```$", "", response_text)

        try:
            return json.loads(response_text)
        except Exception as e:
            log.error(e, exc_info=True)
            raise e
