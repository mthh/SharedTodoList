#!/usr/bin/env python3.5
# -*- coding: utf-8 -*-
import asyncio
import logging
import os
import random
import string
import ujson as json
import uvloop
import jinja2
import uuid

import aiohttp_jinja2
from aiohttp import web, WSMsgType
#from aiohttp_session import session_middleware
#from aiohttp_session.cookie_storage import EncryptedCookieStorage

@aiohttp_jinja2.template('todos.html')
async def todo_page(request):
    return {"title": "Shared todo-list example"}

async def broadcast_new_items(app):
    for ws in app['sockets'].values():
        ws.send_str(json.dumps({'action': 'change_list', 'todo_list': app['todo_list']}))

async def ws_todolist(request):
    ws = web.WebSocketResponse()
    ok, protocol = ws.can_start(request)
    if not ok:
        return aiohttp_jinja2.render_template('todos.html', request, {})
    app = request.app
    log = app['logger']
    await ws.prepare(request)
    user_id = uuid.uuid4().hex
    log.info('%s joined on todolist page', user_id)
    ws.send_str(json.dumps({'action': 'connect', 'name': user_id}))
    app['sockets'][user_id] = ws
    async for msg in ws:
        if msg.type == WSMsgType.TEXT:
            if msg == 1001:
                break
            msg = json.loads(msg.data)
            if msg['action'] == "get_list":
                print("list requested :", app['todo_list'])
                ws.send_str(json.dumps({'action': 'change_list', 'todo_list': app['todo_list']}))
            elif msg['action'] == "add_item_list":
                print("item added :", msg['new_item'])
                ix = uuid.uuid4().hex
                app['todo_list'][ix] = msg['new_item']
                asyncio.ensure_future(broadcast_new_items(app))
            elif msg['action'] == "remove_item_list":
                app['todo_list'].pop(msg['ix'])
                asyncio.ensure_future(broadcast_new_items(app))
            # elif msg['action'] == "add_assignee_item": pass
            else:
                ws.send_str(json.dumps({"foo": "bar"}))
        elif msg.type == WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())

    del app['sockets'][user_id]
    log.info('%s disconnected from todolist page.', user_id)
    return ws

def create_app(loop):
    logging.basicConfig(level=logging.DEBUG)
    app = web.Application(loop=loop)
    app['logger'] = logging.getLogger(__name__)
    app['sockets'] = {}
    app['todo_list'] = {}
    app.on_shutdown.append(shutdown)

    aiohttp_jinja2.setup(
        app, loader=jinja2.FileSystemLoader('templates'))

    app.router.add_static('/static/', path='static', name='static')
    add_route = app.router.add_route
    # add_route('GET', '/', index)
    add_route('GET', '/todo', todo_page)
    # add_route('GET', '/vote', vote_page)
    add_route('GET', '/ws_todolist', ws_todolist)
    return app

async def shutdown(app):
    for ws in app['sockets'].values():
        await ws.close()
    app['sockets'].clear()

def main():
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    loop = asyncio.get_event_loop()
    app = create_app(loop=loop)
    handler = app.make_handler()
    async def run():
        srv = await loop.create_server(
            handler, '0.0.0.0', "8888")
        return srv
    srv = loop.run_until_complete(run())
    app['logger'].info('Serving on ' + str(srv.sockets[0].getsockname()))
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.close()
        loop.run_until_complete(srv.wait_closed())
        loop.run_until_complete(app.shutdown())
        loop.run_until_complete(handler.finish_connections(60.0))
        loop.run_until_complete(app.cleanup())
    loop.close()

if __name__ == '__main__':
    main()
