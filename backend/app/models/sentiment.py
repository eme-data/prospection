from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String, nullable=False)
    sources = Column(String, nullable=False)  # comma-separated: news,twitter,manual

    sentiment_score = Column(Float, default=0.0)  # -1 (négatif) à 1 (positif)
    sentiment_label = Column(String, default="neutre")  # positif, négatif, neutre
    total_items = Column(Integer, default=0)
    positive_count = Column(Integer, default=0)
    negative_count = Column(Integer, default=0)
    neutral_count = Column(Integer, default=0)
    summary = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="sentiment_analyses")
    items = relationship("SentimentItem", back_populates="analysis", cascade="all, delete-orphan")


class SentimentItem(Base):
    __tablename__ = "sentiment_items"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("sentiment_analyses.id", ondelete="CASCADE"), nullable=False)
    source = Column(String, nullable=False)  # news, twitter, manual
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    url = Column(String, nullable=True)
    author = Column(String, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)

    sentiment_score = Column(Float, default=0.0)
    sentiment_label = Column(String, default="neutre")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("SentimentAnalysis", back_populates="items")
