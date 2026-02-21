from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class SocialAccount(Base):
    __tablename__ = "social_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String, nullable=False) # linkedin, facebook, instagram
    platform_user_id = Column(String, nullable=False)
    access_token = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="social_accounts")


class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    platform = Column(String, nullable=False) # linkedin, facebook, instagram, both
    ai_model = Column(String, nullable=False) # gemini, groq
    topic = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tone = Column(String, default="professional")
    length = Column(String, default="medium")
    include_hashtags = Column(Boolean, default=True)
    include_emojis = Column(Boolean, default=False)
    
    published_to_linkedin = Column(Boolean, default=False)
    linkedin_post_url = Column(String, nullable=True)
    
    published_to_facebook = Column(Boolean, default=False)
    facebook_post_url = Column(String, nullable=True)
    
    published_to_instagram = Column(Boolean, default=False)
    instagram_post_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True) # Used for instagram
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="posts")
