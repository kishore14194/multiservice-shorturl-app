from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
import time
import hashlib
import redis
import json
import os



redis_client = redis.StrictRedis(
    host=os.getenv('REDIS_HOST', 'redis'),  # default to 'redis' if env var not set
    port=os.getenv('REDIS_PORT', '3306'),
    db=0
)

db_user = os.getenv('MYSQL_USER', 'root')
db_password = os.getenv('MYSQL_PASSWORD', 'admin123')
db_host = os.getenv('MYSQL_HOST', 'mysql')
db_port = os.getenv('MYSQL_PORT', '3306')
db_name = os.getenv('MYSQL_DB', 'short_url')

for _ in range(10):  # try 10 times
    try:
        engine = create_engine(f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}", echo=True)
        connection = engine.connect()
        connection.close()
        print("✅ MySQL is ready!")
        break
    except OperationalError:
        print("⏳ Waiting for MySQL...")
        time.sleep(3)
else:
    raise Exception("❌ Could not connect to MySQL after multiple attempts.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Test the connection
connection = engine.connect()

# Base class
Base = declarative_base()

# Define the table (model)
class UrlStore(Base):
    __tablename__ = 'urlStore'

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(1000), nullable=False)
    shortcode = Column(String(100), unique=True, nullable=False)
    access_count = Column(Integer, default=0)
    create_at = Column(DateTime, default=datetime.now)
    update_at = Column(DateTime, default=datetime.now)

class UrlItems(BaseModel):
    url: str

    class Config:
        orm_mode = True

# Define the response model for the shortened URL
class ShortUrlResponse(BaseModel):
    shortcode: str
    shortened_url: str

    class Config:
        orm_mode = True

# Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

def update_access_count(short_url_id):
    url_data = session.query(UrlStore).filter_by(shortcode=short_url_id).first()
    if url_data:
        url_data.access_count = url_data.access_count+1
        url_data.update_at = datetime.now()
        session.commit()

@app.post("/shorten/", response_model=ShortUrlResponse)
def get_short_url(url_store: UrlItems):
    # Check cache for existing URL
    cached = redis_client.get(url_store.url)
    if cached:
        return {"shortened_url": cached.decode("utf-8")}

    encoded_url = url_store.url.encode()
    hash_object = hashlib.md5(encoded_url)
    hex_dig = hash_object.hexdigest()
    new_short_url = UrlStore(url=url_store.url, shortcode=hex_dig[:6], update_at=datetime.now())
    session.add(new_short_url)
    session.commit()
    session.refresh(new_short_url)

    redis_client.set(url_store.url, new_short_url.shortcode)

    return ShortUrlResponse(shortcode=new_short_url.shortcode, shortened_url=new_short_url.url)

@app.get("/shorten/{short_url_id}", response_model=ShortUrlResponse)
def get_short_url(short_url_id, update_access_count_value = True):
    # Check cache for short URL data
    cached_url = redis_client.get(short_url_id)
    if cached_url:
        # return {"url": cached_url.decode("utf-8")}
        return RedirectResponse(url=cached_url.decode("utf-8"))

    if update_access_count_value:
        update_access_count(short_url_id)
    new_short_url = session.query(UrlStore).filter_by(shortcode=short_url_id).first()
    if new_short_url:
        redis_client.set(short_url_id, new_short_url.url)
        return RedirectResponse(url=new_short_url.url)
    else:
        raise HTTPException(status_code=404, detail="Short URL not found")


@app.put("/shorten/{short_url_id}", response_model=ShortUrlResponse)
def update_short_url(short_url_id, url_item: UrlItems):
    short_url_data = session.query(UrlStore).filter_by(shortcode=short_url_id).first()
    if short_url_data:
        short_url_data.url = url_item.url
        short_url_data.update_at = datetime.now()
        session.commit()
        session.refresh(short_url_data)

    urls = session.query(UrlStore).all()
    urls_data = [{"url": url.url, "shortcode": url.shortcode} for url in urls]
    redis_client.set("all_urls", json.dumps(urls_data))

    return ShortUrlResponse(shortcode=short_url_data.shortcode, shortened_url=short_url_data.url)

@app.delete("/shorten/{short_url_id}")
def update_short_url(short_url_id):
    short_url_data = session.query(UrlStore).filter_by(shortcode=short_url_id).first()
    if short_url_data:
        session.delete(short_url_data)

    urls = session.query(UrlStore).all()
    urls_data = [{"url": url.url, "shortcode": url.shortcode} for url in urls]

    redis_client.set("all_urls", json.dumps(urls_data))

    return {"message": f"Sucessfully deleted {short_url_id}"}

@app.get("/get_shorten/all")
def get_all_urls():
    cached = redis_client.get("all_urls")
    if cached:
        return {"urls": json.loads(cached.decode("utf-8"))}

    urls = session.query(UrlStore).all()
    urls_data = [{"url": url.url, "shortcode": url.shortcode} for url in urls]

    redis_client.set("all_urls", json.dumps(urls_data))  # Cache all URLs
    return {"urls": urls_data}