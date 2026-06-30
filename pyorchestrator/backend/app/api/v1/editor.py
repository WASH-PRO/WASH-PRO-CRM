import ast

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class SyntaxCheckRequest(BaseModel):
    code: str


class SyntaxCheckResponse(BaseModel):
    valid: bool
    error: str | None = None


@router.post("/check", response_model=SyntaxCheckResponse)
async def check_syntax(body: SyntaxCheckRequest):
    try:
        ast.parse(body.code)
        return SyntaxCheckResponse(valid=True)
    except SyntaxError as e:
        return SyntaxCheckResponse(valid=False, error=str(e))
