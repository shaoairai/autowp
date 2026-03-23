from apscheduler.schedulers.background import BackgroundScheduler


def create_scheduler(app):
    scheduler = BackgroundScheduler(daemon=True)

    def run_trigger():
        with app.app_context():
            from routes.schedule import run_due_scheduled_posts
            run_due_scheduled_posts()

    scheduler.add_job(
        run_trigger,
        'interval',
        seconds=60,
        id='scheduled_posts_trigger',
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    return scheduler
