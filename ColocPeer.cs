using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;

namespace ColocDuty
{
    class ColocPeer
    {
        public readonly WebSocket Socket;
        public ColocPlayer Player;
        public bool IsViewer;

        public ColocPeer(WebSocket socket)
        {
            Socket = socket;
        }
    }
}
