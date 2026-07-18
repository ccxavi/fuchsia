from __future__ import annotations

import logging
import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from exponent_server_sdk import (
    PushClient,
    PushMessage,
    PushServerError,
)

from app.db.session import get_session_factory
from app.models.user import User
from app.models.calendar_outfit import CalendarOutfit
from app.models.outfit import Outfit
from app.models.outfit_image import OutfitImage

logger = logging.getLogger(__name__)

# Initialize the scheduler
scheduler = BackgroundScheduler(timezone="Asia/Manila")


def _send_push_messages(messages: list[PushMessage]) -> None:
    if not messages:
        return
    try:
        responses = PushClient().publish_multiple(messages)
        logger.info(f"Sent {len(responses)} push notifications.")
    except PushServerError as exc:
        logger.error(f"Expo push server error: {exc.errors}")
        logger.error(f"Expo push server error message: {exc.message}")
    except Exception as e:
        logger.exception(f"Failed to send push notifications: {e}")


def send_tomorrow_outfit_reminder() -> None:
    """
    Scheduled for 8:00 PM daily.
    Checks if users have an outfit scheduled for tomorrow.
    """
    logger.info("Starting tomorrow outfit reminder job...")
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    
    with get_session_factory()() as db:
        # Find all calendar outfits scheduled for tomorrow
        # Join with users to check their preferences and token
        stmt = (
            select(CalendarOutfit, User, Outfit)
            .join(Outfit, CalendarOutfit.outfit_id == Outfit.id)
            .join(User, Outfit.user_id == User.id)
            .where(
                CalendarOutfit.date == tomorrow,
                User.daily_reminders == True,
                User.push_token.is_not(None)
            )
        )
        
        results = db.execute(stmt).all()
        
        messages = []
        # Keep track of users we already messaged to avoid spamming
        messaged_user_ids = set()
        
        for calendar_outfit, user, outfit in results:
            if user.id in messaged_user_ids:
                continue
            if not user.push_token or not user.push_token.startswith("ExponentPushToken["):
                continue

            messages.append(
                PushMessage(
                    to=user.push_token,
                    title="Outfit set for tomorrow! ✨",
                    body=f"You're wearing your '{outfit.name}' outfit tomorrow. Make sure it's ironed and ready!",
                    sound="default",
                    data={"route": "/calendar"},
                )
            )
            messaged_user_ids.add(user.id)

        _send_push_messages(messages)


def send_empty_calendar_nudge() -> None:
    """
    Scheduled for 10:00 AM daily.
    Checks if users DO NOT have an outfit scheduled for today.
    """
    logger.info("Starting empty calendar nudge job...")
    today = datetime.date.today()
    
    with get_session_factory()() as db:
        # Get users with daily_reminders enabled
        users = db.scalars(
            select(User).where(
                User.daily_reminders == True,
                User.push_token.is_not(None)
            )
        ).all()
        
        messages = []
        for user in users:
            if not user.push_token or not user.push_token.startswith("ExponentPushToken["):
                continue
                
            # Check if user has an outfit for today
            stmt = (
                select(CalendarOutfit)
                .join(Outfit)
                .where(Outfit.user_id == user.id, CalendarOutfit.date == today)
            )
            has_outfit = db.scalar(stmt) is not None
            
            if not has_outfit:
                messages.append(
                    PushMessage(
                        to=user.push_token,
                        title="What are you wearing today? 👗",
                        body="Your calendar is empty for today. Take a quick pic and log your outfit!",
                        sound="default",
                        data={"route": "/calendar"},
                    )
                )

        _send_push_messages(messages)


def send_unworn_clothes_alert() -> None:
    """
    Scheduled for 4:00 PM on Sundays.
    Finds an outfit the user hasn't worn in > 30 days and nudges them to wear it.
    """
    logger.info("Starting unworn clothes alert job...")
    thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
    
    with get_session_factory()() as db:
        users = db.scalars(
            select(User).where(
                User.daily_reminders == True,
                User.push_token.is_not(None)
            )
        ).all()
        
        messages = []
        for user in users:
            if not user.push_token or not user.push_token.startswith("ExponentPushToken["):
                continue
                
            # Find an outfit that was either worn > 30 days ago, or never worn
            stmt = (
                select(Outfit)
                .where(Outfit.user_id == user.id)
                .where(
                    or_(
                        Outfit.last_worn < thirty_days_ago,
                        Outfit.last_worn == None
                    )
                )
                .limit(1)
            )
            neglected_outfit = db.scalar(stmt)
            
            if neglected_outfit:
                messages.append(
                    PushMessage(
                        to=user.push_token,
                        title="Neglected Clothes Alert 🥺",
                        body=f"You haven't worn your '{neglected_outfit.name}' in a while! Try styling it this week.",
                        sound="default",
                        data={"route": "/outfits"},
                    )
                )

        _send_push_messages(messages)


def send_fit_pic_reminder() -> None:
    """
    Scheduled for 5:00 PM daily.
    Checks if users have an outfit scheduled for today but haven't logged a photo of it yet.
    """
    logger.info("Starting fit pic reminder job...")
    today = datetime.date.today()
    
    with get_session_factory()() as db:
        users = db.scalars(
            select(User).where(
                User.daily_reminders == True,
                User.push_token.is_not(None)
            )
        ).all()
        
        messages = []
        for user in users:
            if not user.push_token or not user.push_token.startswith("ExponentPushToken["):
                continue
                
            # Find the outfit scheduled for today
            stmt_calendar = (
                select(CalendarOutfit)
                .join(Outfit)
                .where(Outfit.user_id == user.id, CalendarOutfit.date == today)
                .limit(1)
            )
            calendar_outfit = db.scalar(stmt_calendar)
            
            if calendar_outfit:
                # Check if there is an OutfitImage for this outfit with today's date
                stmt_image = (
                    select(OutfitImage)
                    .where(
                        OutfitImage.outfit_id == calendar_outfit.outfit_id,
                        OutfitImage.date == today
                    )
                )
                has_image = db.scalar(stmt_image) is not None
                
                if not has_image:
                    messages.append(
                        PushMessage(
                            to=user.push_token,
                            title="Outfit check! 📸",
                            body="Loving today's outfit? Take a quick mirror selfie to save the memory before you change!",
                            sound="default",
                            data={"route": "/outfits"},
                        )
                    )

        _send_push_messages(messages)


def start_scheduler() -> None:
    """Start the APScheduler background jobs."""
    if not scheduler.running:
        # 1. 10:00 AM Daily - Empty calendar nudge
        scheduler.add_job(
            send_empty_calendar_nudge,
            trigger=CronTrigger(hour=10, minute=0, timezone="Asia/Manila"),
            id="empty_calendar_nudge_job",
            replace_existing=True,
        )
        
        # 2. 8:00 PM Daily - Tomorrow outfit reminder
        scheduler.add_job(
            send_tomorrow_outfit_reminder,
            trigger=CronTrigger(hour=20, minute=0, timezone="Asia/Manila"),
            id="tomorrow_outfit_reminder_job",
            replace_existing=True,
        )
        
        # 3. 4:00 PM Sundays - Unworn clothes alert (day_of_week=6 is Sunday)
        scheduler.add_job(
            send_unworn_clothes_alert,
            trigger=CronTrigger(day_of_week=6, hour=16, minute=0, timezone="Asia/Manila"),
            id="unworn_clothes_alert_job",
            replace_existing=True,
        )
        
        # 4. 5:00 PM Daily - Fit pic reminder
        scheduler.add_job(
            send_fit_pic_reminder,
            trigger=CronTrigger(hour=17, minute=0, timezone="Asia/Manila"),
            id="fit_pic_reminder_job",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("APScheduler started and jobs scheduled.")


def shutdown_scheduler() -> None:
    """Gracefully shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shut down.")
