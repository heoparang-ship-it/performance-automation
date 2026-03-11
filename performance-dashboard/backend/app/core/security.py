"""인증/보안 유틸리티."""

from __future__ import annotations

import datetime as dt

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from ..database import get_db
from ..models.user import User

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """비밀번호를 bcrypt로 해싱."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """비밀번호 검증."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, email: str, role: str) -> str:
    """JWT 액세스 토큰 생성."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": dt.datetime.utcnow() + dt.timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": dt.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """JWT 토큰 디코딩."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """인증 없이 첫 번째 사용자(master)를 반환. 로그인 기능 비활성화."""
    user = db.query(User).first()
    if not user:
        # DB에 유저가 없으면 임시 유저 객체 반환
        dummy = User()
        dummy.id = 1
        dummy.email = "admin@local"
        dummy.name = "관리자"
        dummy.role = "master"
        return dummy
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """로그인 비활성화 상태에서 항상 통과."""
    return current_user
